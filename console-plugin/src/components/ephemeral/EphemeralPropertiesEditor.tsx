import * as React from 'react';
import {
  Alert,
  Button,
  ExpandableSection,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
  Radio,
} from '@patternfly/react-core';
import { PlusCircleIcon, MinusCircleIcon } from '@patternfly/react-icons';
import { API_BASE as K8S_FLOW_API } from '../../constants';
import type { TemplatePropertyConfig } from '../../utils/templateProperties';
import { recordToPropertyEntries, propertyEntriesToRecord } from '../../utils/templateProperties';

const API_BASE = K8S_FLOW_API;

function getCsrfToken(): string {
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : '';
}

export interface EphemeralPropertiesEditorProps {
  flowNamespace: string;
  enabled: boolean;
  properties: Record<string, string>;
  onPropertiesChange: (properties: Record<string, string>) => void;
  secretName: string;
  onSecretNameChange: (name: string) => void;
  templateConfig: TemplatePropertyConfig | null;
  templateName?: string;
  createSecretMode: boolean;
  onCreateSecretModeChange: (create: boolean) => void;
  secretData: Record<string, string>;
  onSecretDataChange: (data: Record<string, string>) => void;
}

const EphemeralPropertiesEditor: React.FC<EphemeralPropertiesEditorProps> = ({
  flowNamespace,
  enabled,
  properties,
  onPropertiesChange,
  secretName,
  onSecretNameChange,
  templateConfig,
  templateName,
  createSecretMode,
  onCreateSecretModeChange,
  secretData,
  onSecretDataChange,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const [secrets, setSecrets] = React.useState<string[]>([]);
  const [loadingSecrets, setLoadingSecrets] = React.useState(false);

  const entries = React.useMemo(() => recordToPropertyEntries(properties), [properties]);
  const secretEntries = React.useMemo(() => recordToPropertyEntries(secretData), [secretData]);

  const updateSecretEntry = (index: number, field: 'key' | 'value', value: string) => {
    const next = [...secretEntries];
    next[index] = { ...next[index], [field]: value };
    onSecretDataChange(propertyEntriesToRecord(next));
  };

  const addSecretEntry = () => {
    onSecretDataChange(propertyEntriesToRecord([...secretEntries, { key: '', value: '' }]));
  };

  const removeSecretEntry = (index: number) => {
    const next = secretEntries.filter((_, i) => i !== index);
    onSecretDataChange(propertyEntriesToRecord(next));
  };

  React.useEffect(() => {
    if (!enabled) return;
    const hasProps = Object.keys(properties).length > 0;
    const hasRequired = (templateConfig?.requiredSecrets?.length ?? 0) > 0;
    setExpanded(hasProps || hasRequired);
  }, [enabled, templateName, templateConfig, properties]);

  React.useEffect(() => {
    if (!enabled || !expanded || !flowNamespace) return;
    setLoadingSecrets(true);
    fetch(`${API_BASE}/namespaces/${flowNamespace}/secrets`, {
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
  }, [enabled, expanded, flowNamespace]);

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
          or edit values before Create (e.g. <code>base-url</code> for MaaS/OpenAI-compatible gateways).
          {requiredSecrets.length > 0 && (
            <div style={{ marginTop: '6px' }}>
              Typical Secret keys: <code>{requiredSecrets.join(', ')}</code>
              {requiredSecrets.includes('OPENAI_API_KEY') && (
                <span> — optional <code>OPENAI_BASE_URL</code>, <code>OPENAI_MODEL</code></span>
              )}
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

      <div style={{ marginTop: '16px', borderTop: '1px solid var(--integration-border)', paddingTop: '12px' }}>
        <div style={{ marginBottom: '12px', display: 'flex', gap: '16px' }}>
          <Radio
            isChecked={!createSecretMode}
            name="secret-mode"
            onChange={() => onCreateSecretModeChange(false)}
            label="Use existing Secret"
            id="secret-mode-existing"
          />
          <Radio
            isChecked={createSecretMode}
            name="secret-mode"
            onChange={() => onCreateSecretModeChange(true)}
            label="Create new Secret"
            id="secret-mode-create"
          />
        </div>

        {!createSecretMode ? (
          <FormGroup label="Select Secret (envFrom)" fieldId="ephemeral-secret">
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
        ) : (
          <FormGroup label="New Secret Data" fieldId="ephemeral-secret-data">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {secretEntries.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--integration-text-subtle)', margin: 0 }}>
                  No keys defined. Add keys like OPENAI_API_KEY.
                </p>
              ) : (
                secretEntries.map((entry, index) => (
                  <div key={`sec-${index}`} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextInput
                      value={entry.key}
                      onChange={(_e, v) => updateSecretEntry(index, 'key', v)}
                      placeholder="OPENAI_API_KEY"
                      aria-label={`Secret key ${index + 1}`}
                      style={{ flex: '1 1 200px', fontFamily: 'monospace', fontSize: '12px' }}
                    />
                    <TextInput
                      value={entry.value}
                      onChange={(_e, v) => updateSecretEntry(index, 'value', v)}
                      placeholder="sk-..."
                      type="password"
                      aria-label={`Secret value ${index + 1}`}
                      style={{ flex: '1 1 200px', fontFamily: 'monospace', fontSize: '12px' }}
                    />
                    <Button
                      variant="plain"
                      aria-label="Remove secret key"
                      onClick={() => removeSecretEntry(index)}
                      style={{ padding: '4px' }}
                    >
                      <MinusCircleIcon />
                    </Button>
                  </div>
                ))
              )}
              <Button variant="link" icon={<PlusCircleIcon />} onClick={addSecretEntry} style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>
                Add secret key
              </Button>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--integration-text-subtle)', marginTop: '4px' }}>
              A Secret named <code>{templateName ? `${templateName}-credentials` : 'flow-credentials'}</code> will be created automatically.
            </p>
          </FormGroup>
        )}
      </div>
    </ExpandableSection>
  );
};

export default EphemeralPropertiesEditor;
