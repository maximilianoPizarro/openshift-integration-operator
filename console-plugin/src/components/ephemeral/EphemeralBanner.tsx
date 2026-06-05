import * as React from 'react';
import { Alert, AlertActionCloseButton } from '@patternfly/react-core';

export interface EphemeralBannerProps {
  expiresAt?: string;
  onDismiss?: () => void;
}

export const EphemeralBanner: React.FC<EphemeralBannerProps> = ({ expiresAt, onDismiss }) => (
  <Alert
    variant="info"
    isInline
    title="Quick Try mode"
    actionClose={onDismiss ? <AlertActionCloseButton onClose={onDismiss} /> : undefined}
  >
    This flow runs in ephemeral mode without Git or ArgoCD.
    {expiresAt ? ` Expires at ${new Date(expiresAt).toLocaleString()}.` : ''}
    {' '}Use Promote to GitOps when ready for production.
  </Alert>
);

export default EphemeralBanner;
