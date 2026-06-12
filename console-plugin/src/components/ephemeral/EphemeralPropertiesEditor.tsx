import * as React from 'react';
import {
  Alert,
  Button,
  ExpandableSection,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
} from '@patternfly/react-core';
import { PlusCircleIcon, MinusCircleIcon } from '@patternfly/react-icons';
import { NAMESPACE, API_BASE as K8S_FLOW_API } from '../../constants';
import type { TemplatePropertyConfig } from '../../utils/templateProperties';
import { recordToPropertyEntries, propertyEntriesToRecord } from '../../utils/templateProperties';

const API_BASE = K8S_FLOW_API;

function getCsrfToken(): string {
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : '';
}

export interface EphemeralPropertiesEditorProps {
  enabled: boolean;
  properties: Record<string, string>;
  onPropertiesChange: (properties: Record<string, string>) => void;
  secretName: string;
  onSecretNameChange: (name: string) => void;
  templateConfig: TemplatePropertyConfig | null;
  templateName?: string;
}

const EphemeralPropertiesEditor: React.FC<EphemeralPropertiesEditorProps> = ({
  enabled,
  properties,
  onPropertiesChange,
  secretName,
  onSecretNameChange,
  templateConfig,
  templateName,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const [secrets, setSecrets] = React.useState<string[]>([]);
  const [loadingSecrets, setLoadingSecrets] = React.useState(false);

  const entries = React.useMemo(() => recordToPropertyEntries(properties), [properties]);

  React.useEffect(() => {
    if (!enabled) return;
    const hasProps = Object.keys(properties).length > 0;
    const hasRequired = (templateConfig?.requiredSecrets?.length ?? 0) > 0;
    setExpanded(hasProps || hasRequired);
  }, [enabled, templateName, templateConfig, properties]);

  React.useEffect(() => {
    if (!enabled || !expanded) return;
    setLoadingSecrets(true);
    fetch(`${API_BASE}/namespaces/${NAMESPACE}/secrets`, {
      headers: { 'X-CSRFToken': getCsrfToken() },
    })
      .then(r => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: { metadata?: { name?: string } }[] }) => {
        const names = (data.items || [])
          .map(s => s.metadata?.name)
          .filter((n): n is string => !!n && !n.startsWith('builder-') && !n.endsWith('-dockercfg'));
        setSecrets(names.sort());
      })
      .catch(() => setSecrets([]))
      .finally(() => setLoadingSecrets(false));
  }, [enabled, expanded]);

  const updateEntry = (index: number, field: 'key' | 'value', value: string) => {
    const next = [...entries];
    next[index] = { ...next[index], [field]: value };
    onPropertiesChange(propertyEntriesToRecord(next));
  };

  const addEntry = () => {
    onPropertiesChange(propertyEntriesToRecord([...entries, { key: '', value: '' }]));
  };

  const removeEntry = (index: number) => {
    const next = entries.filter((_, i) => i !== index);
    onPropertiesChange(propertyEntriesToRecord(next));
  };

  if (!enabled) return null;

  const requiredSecrets = templateConfig?.requiredSecrets ?? [];

  return (
    <ExpandableSection
      toggleText="Worker properties (optional)"
      isExpanded={expanded}
      onToggle={(_e, isExpanded) => setExpanded(isExpanded)}
      style={{ marginTop: '12px' }}
    >
      {templateName && templateConfig && Object.keys(templateConfig.properties).length > 0 && (
        <Alert variant="info" isInline title={`Minimum properties for ${templateName}`} style={{ marginBottom: '12px' }}>
          Pre-filled from template components. Values use <code>${'${ENV_VAR}'}</code> placeholders — bind a Secret below
          or edit keys before Create.
          {requiredSecrets.length > 0 && (
            <div style={{ marginTop: '6px' }}>
              Required Secret keys: <code>{requiredSecrets.join(', ')}</code>
            </div>
          )}
        </Alert>
      )}

      {templateConfig?.hints.map(h => (
        <p key={h} style={{ fontSize: '12px', color: 'var(--integration-text-subtle)', margin: '0 0 8px' }}>{h}</p>
      ))}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {entries.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--integration-text-subtle)', margin: 0 }}>
            No properties yet. Add rows or load a template with components that need configuration.
          </p>
        ) : (
          entries.map((entry, index) => (
            <div key={`prop-${index}`} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <TextInput
                value={entry.key}
                onChange={(_e, v) => updateEntry(index, 'key', v)}
                placeholder="quarkus.langchain4j.openai.chat-model.model-name"
                aria-label={`Property key ${index + 1}`}
                style={{ flex: '1 1 280px', fontFamily: 'monospace', fontSize: '12px' }}
              />
              <TextInput
                value={entry.value}
                onChange={(_e, v) => updateEntry(index, 'value', v)}
                placeholder="gpt-4o-mini or ${OPENAI_API_KEY}"
                aria-label={`Property value ${index + 1}`}
                style={{ flex: '1 1 200px', fontFamily: 'monospace', fontSize: '12px' }}
              />
              <Button
                variant="plain"
                aria-label="Remove property"
                onClick={() => removeEntry(index)}
                style={{ padding: '4px' }}
              >
                <MinusCircleIcon />
              </Button>
            </div>
          ))
        )}
        <Button variant="link" icon={<PlusCircleIcon />} onClick={addEntry} style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>
          Add property
        </Button>
      </div>

      <FormGroup label="Secret (envFrom)" fieldId="ephemeral-secret">
        <FormSelect
          id="ephemeral-secret"
          value={secretName}
          onChange={(_e, value) => onSecretNameChange(value)}
          aria-label="Kubernetes secret for envFrom"
        >
          <FormSelectOption value="" label={loadingSecrets ? 'Loading secrets...' : '— None (use property placeholders only) —'} />
          {secrets.map(name => (
            <FormSelectOption key={name} value={name} label={name} />
          ))}
          {templateConfig?.defaultSecretName &&
            !secrets.includes(templateConfig.defaultSecretName) && (
            <FormSelectOption
              value={templateConfig.defaultSecretName}
              label={`${templateConfig.defaultSecretName} (create before deploy)`}
            />
          )}
        </FormSelect>
        <p style={{ fontSize: '11px', color: 'var(--integration-text-subtle)', marginTop: '4px' }}>
          Maps to <code>spec.secrets[].envFrom: true</code>. Do not paste API keys in property values.
        </p>
      </FormGroup>
    </ExpandableSection>
  );
};

export default EphemeralPropertiesEditor;
