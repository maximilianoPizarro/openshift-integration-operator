import * as React from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@patternfly/react-core';

export interface ConfirmLifecycleModalProps {
  isOpen: boolean;
  action: 'pause' | 'stop' | 'rollback';
  flowName: string;
  detail?: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

const TITLES: Record<string, string> = {
  pause: 'Pause flow?',
  stop: 'Stop flow?',
  rollback: 'Rollback flow?',
};

const ConfirmLifecycleModal: React.FC<ConfirmLifecycleModalProps> = ({
  isOpen, action, flowName, detail, onClose, onConfirm, loading,
}) => (
  <Modal
    variant="small"
    isOpen={isOpen}
    onClose={onClose}
    aria-label={TITLES[action]}
  >
    <ModalHeader
      title={TITLES[action]}
      titleIconVariant={action === 'stop' ? 'warning' : undefined}
    />
    <ModalBody>
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
    </ModalBody>
    <ModalFooter>
      <Button
        key="confirm"
        variant={action === 'stop' ? 'danger' : 'primary'}
        isDisabled={loading}
        onClick={onConfirm}
      >
        {action === 'pause' ? 'Pause' : action === 'stop' ? 'Stop' : 'Rollback'}
      </Button>
      <Button key="cancel" variant="link" onClick={onClose}>Cancel</Button>
    </ModalFooter>
  </Modal>
);

export default ConfirmLifecycleModal;
