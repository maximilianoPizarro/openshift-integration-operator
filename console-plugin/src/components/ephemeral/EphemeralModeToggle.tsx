import * as React from 'react';
import { FormGroup, FormSelect, FormSelectOption, Switch } from '@patternfly/react-core';

export interface EphemeralModeToggleProps {
  ephemeral: boolean;
  onChange: (ephemeral: boolean) => void;
  ttlSeconds: number;
  onTtlChange: (seconds: number) => void;
}

const TTL_OPTIONS = [
  { value: 3600, label: '1 hour' },
  { value: 14400, label: '4 hours' },
  { value: 86400, label: '24 hours' },
];

export const EphemeralModeToggle: React.FC<EphemeralModeToggleProps> = ({
  ephemeral,
  onChange,
  ttlSeconds,
  onTtlChange,
}) => (
  <>
    <FormGroup label="Deployment mode" fieldId="deployment-mode">
      <Switch
        id="deployment-mode"
        label={ephemeral ? 'Quick Try (ephemeral — no Git or ArgoCD)' : 'GitOps (production pipeline)'}
        isChecked={ephemeral}
        onChange={(_e, checked) => onChange(checked)}
      />
    </FormGroup>
    {ephemeral && (
      <FormGroup label="Time to live" fieldId="ephemeral-ttl">
        <FormSelect
          id="ephemeral-ttl"
          value={String(ttlSeconds)}
          onChange={(_e, value) => onTtlChange(Number(value))}
        >
          {TTL_OPTIONS.map(opt => (
            <FormSelectOption key={opt.value} value={String(opt.value)} label={opt.label} />
          ))}
        </FormSelect>
      </FormGroup>
    )}
  </>
);

export default EphemeralModeToggle;
