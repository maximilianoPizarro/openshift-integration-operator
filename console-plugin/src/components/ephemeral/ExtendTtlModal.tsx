import * as React from 'react';
import {
  Button,
  Form,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';

import { PROXY_BASE } from '../../constants';

function getCsrfToken(): string {
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : '';
}

export interface ExtendTtlModalProps {
  flowName: string;
  isOpen: boolean;
  onClose: () => void;
  onExtended: () => void;
}

export const ExtendTtlModal: React.FC<ExtendTtlModalProps> = ({ flowName, isOpen, onClose, onExtended }) => {
  const [hours, setHours] = React.useState('1');
  const [loading, setLoading] = React.useState(false);

  const handleExtend = async () => {
    setLoading(true);
    try {
      const seconds = Number(hours) * 3600;
      const resp = await fetch(`${PROXY_BASE}/api/flows/${flowName}/ephemeral/extend?seconds=${seconds}`, {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfToken() },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      onExtended();
      onClose();
    } catch (e: unknown) {
      alert(`Extend TTL failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal variant="small" isOpen={isOpen} onClose={onClose} aria-label="Extend ephemeral TTL">
      <ModalHeader title="Extend ephemeral TTL" />
      <ModalBody>
        <Form>
          <FormGroup label="Additional hours" fieldId="extend-hours">
            <TextInput id="extend-hours" type="number" value={hours} onChange={(_e, v) => setHours(v)} />
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={handleExtend} isDisabled={loading}>
          {loading ? 'Extending...' : 'Extend TTL'}
        </Button>
        <Button variant="link" onClick={onClose}>Cancel</Button>
      </ModalFooter>
    </Modal>
  );
};

export default ExtendTtlModal;
