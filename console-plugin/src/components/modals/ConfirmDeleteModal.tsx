import * as React from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';

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
      variant="small"
      isOpen={isOpen}
      onClose={onClose}
      aria-label="Delete IntegrationFlow"
    >
      <ModalHeader
        title="Delete IntegrationFlow?"
        titleIconVariant="danger"
      />
      <ModalBody>
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
      </ModalBody>
      <ModalFooter>
        <Button key="delete" variant="danger" isDisabled={typed !== resourceName || loading} onClick={onConfirm}>
          Delete
        </Button>
        <Button key="cancel" variant="link" onClick={onClose}>Cancel</Button>
      </ModalFooter>
    </Modal>
  );
};

export default ConfirmDeleteModal;
