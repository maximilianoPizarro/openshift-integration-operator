import * as React from 'react';
import {
  Button,
  Modal,
  ModalVariant,
  TextInput,
} from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  resourceName: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen, resourceName, onClose, onConfirm, loading,
}) => {
  const [typed, setTyped] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) setTyped('');
  }, [isOpen]);

  return (
    <Modal
      variant={ModalVariant.small}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ExclamationTriangleIcon color="var(--pf-global--danger-color--100)" />
          Delete IntegrationFlow?
        </span>
      }
      isOpen={isOpen}
      onClose={onClose}
      actions={[
        <Button key="delete" variant="danger" isDisabled={typed !== resourceName || loading} onClick={onConfirm}>
          Delete
        </Button>,
        <Button key="cancel" variant="link" onClick={onClose}>Cancel</Button>,
      ]}
    >
      <p>
        This will permanently delete <strong>{resourceName}</strong> and trigger cleanup of
        ephemeral resources and related ArgoCD applications.
      </p>
      <p>Type <strong>{resourceName}</strong> to confirm:</p>
      <TextInput
        value={typed}
        onChange={(_e, v) => setTyped(v)}
        aria-label="Confirm flow name"
      />
    </Modal>
  );
};

export default ConfirmDeleteModal;
