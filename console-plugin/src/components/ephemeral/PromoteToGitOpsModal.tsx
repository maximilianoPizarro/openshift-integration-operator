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
import { flowApiPath } from '../../utils/k8sUrls';

function getCsrfToken(): string {
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : '';
}

export interface PromoteToGitOpsModalProps {
  flowNamespace: string;
  flowName: string;
  isOpen: boolean;
  onClose: () => void;
  onPromoted: () => void;
  defaultRepo?: string;
}

export const PromoteToGitOpsModal: React.FC<PromoteToGitOpsModalProps> = ({
  flowNamespace,
  flowName,
  isOpen,
  onClose,
  onPromoted,
  defaultRepo,
}) => {
  const [gitRepository, setGitRepository] = React.useState(defaultRepo || '');
  const [branch, setBranch] = React.useState('main');
  const [loading, setLoading] = React.useState(false);

  const handlePromote = async () => {
    if (!gitRepository.trim()) {
      alert('Git repository URL is required');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${PROXY_BASE}${flowApiPath(flowNamespace, flowName, '/promote-to-gitops')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        body: JSON.stringify({ gitRepository, branch }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      onPromoted();
      onClose();
    } catch (e: unknown) {
      alert(`Promote failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal variant="medium" isOpen={isOpen} onClose={onClose} aria-label="Promote to GitOps">
      <ModalHeader title="Promote to GitOps" />
      <ModalBody>
        <Form>
          <FormGroup label="Git repository URL" fieldId="promote-repo" isRequired>
            <TextInput
              id="promote-repo"
              value={gitRepository}
              onChange={(_e, v) => setGitRepository(v)}
              placeholder="https://gitea.example.com/org/repo"
            />
          </FormGroup>
          <FormGroup label="Branch" fieldId="promote-branch">
            <TextInput id="promote-branch" value={branch} onChange={(_e, v) => setBranch(v)} />
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={handlePromote} isDisabled={loading}>
          {loading ? 'Promoting...' : 'Promote to GitOps'}
        </Button>
        <Button variant="link" onClick={onClose}>Cancel</Button>
      </ModalFooter>
    </Modal>
  );
};

export default PromoteToGitOpsModal;
