import * as React from 'react';
import { Button, Modal, ModalVariant } from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';

export interface ConfirmLifecycleModalProps {
  isOpen: boolean;
  action: 'pause' | 'stop' | 'rollback';
  flowName: string;
  detail?: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

const TITLES = {
  pause: 'Pause flow?',
  stop: 'Stop flow?',
  rollback: 'Rollback flow?',
};

const ConfirmLifecycleModal: React.FC<ConfirmLifecycleModalProps> = ({
  isOpen, action, flowName, detail, onClose, onConfirm, loading,
}) => (
  <Modal
    variant={ModalVariant.small}
    title={
      action === 'stop' ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ExclamationTriangleIcon color="var(--pf-global--warning-color--100)" />
          {TITLES[action]}
        </span>
      ) : TITLES[action]
    }
    isOpen={isOpen}
    onClose={onClose}
    actions={[
      <Button
        key="confirm"
        variant={action === 'stop' ? 'danger' : 'primary'}
        isDisabled={loading}
        onClick={onConfirm}
      >
        {action === 'pause' ? 'Pause' : action === 'stop' ? 'Stop' : 'Rollback'}
      </Button>,
      <Button key="cancel" variant="link" onClick={onClose}>Cancel</Button>,
    ]}
  >
    <p>
      {action === 'pause' && (
        <>Pause <strong>{flowName}</strong>? Worker pods will be scaled to zero until resumed.</>
      )}
      {action === 'stop' && (
        <>Stop <strong>{flowName}</strong>? This scales down workloads and suspends GitOps sync.</>
      )}
      {action === 'rollback' && (
        <>Rollback <strong>{flowName}</strong> to commit {detail}?</>
      )}
    </p>
  </Modal>
);

export default ConfirmLifecycleModal;
