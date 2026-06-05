import * as React from 'react';
import { Label } from '@patternfly/react-core';

function formatCountdown(expiresAt: string | undefined): string {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m left`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m left`;
}

export interface EphemeralBadgeProps {
  deploymentMode?: string;
  ephemeralExpiresAt?: string;
}

export const EphemeralBadge: React.FC<EphemeralBadgeProps> = ({ deploymentMode, ephemeralExpiresAt }) => {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (deploymentMode !== 'EPHEMERAL') return undefined;
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [deploymentMode]);

  if (deploymentMode !== 'EPHEMERAL') {
    return <Label color="grey">GitOps</Label>;
  }

  const countdown = formatCountdown(ephemeralExpiresAt);
  return (
    <Label color="blue">
      Ephemeral{countdown ? ` · ${countdown}` : ''}
    </Label>
  );
};

export default EphemeralBadge;
