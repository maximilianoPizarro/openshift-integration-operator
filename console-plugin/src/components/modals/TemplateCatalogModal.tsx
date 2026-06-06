import * as React from 'react';
import {
  Alert,
  Button,
  Modal,
  ModalVariant,
  SearchInput,
  Spinner,
  Title,
} from '@patternfly/react-core';
import { FLOW_CATALOG_URL } from '../../constants';

export interface FlowTemplate {
  name: string;
  type: string;
  components: string;
  description: string;
  pattern: string;
  kaotoDesign: string;
}

export interface FlowCategory {
  id: string;
  icon: string;
  title: string;
  flows: FlowTemplate[];
}

export interface TemplateSelection {
  templateName: string;
  categoryId: string;
  categoryTitle: string;
  type: string;
  kaotoDesign: string;
  pattern: string;
  components: string;
  description: string;
}

export interface TemplateCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: TemplateSelection) => void;
}

const TemplateCatalogModal: React.FC<TemplateCatalogModalProps> = ({
  isOpen, onClose, onSelect,
}) => {
  const [catalog, setCatalog] = React.useState<FlowCategory[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('all');

  React.useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setCategoryFilter('all');
    if (catalog.length > 0) return;

    setLoading(true);
    setError(null);
    fetch(FLOW_CATALOG_URL)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: FlowCategory[]) => {
        setCatalog(data);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, [isOpen, catalog.length]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    return catalog
      .filter(cat => categoryFilter === 'all' || cat.id === categoryFilter)
      .map(cat => ({
        ...cat,
        flows: cat.flows.filter(flow => {
          if (!q) return true;
          return (
            flow.name.toLowerCase().includes(q) ||
            flow.components.toLowerCase().includes(q) ||
            flow.description.toLowerCase().includes(q) ||
            flow.pattern.toLowerCase().includes(q) ||
            cat.title.toLowerCase().includes(q)
          );
        }),
      }))
      .filter(cat => cat.flows.length > 0);
  }, [catalog, search, categoryFilter]);

  const totalVisible = filtered.reduce((sum, cat) => sum + cat.flows.length, 0);
  const totalFlows = catalog.reduce((sum, cat) => sum + cat.flows.length, 0);

  const handleSelect = (cat: FlowCategory, flow: FlowTemplate) => {
    onSelect({
      templateName: flow.name,
      categoryId: cat.id,
      categoryTitle: cat.title,
      type: flow.type,
      kaotoDesign: flow.kaotoDesign,
      pattern: flow.pattern,
      components: flow.components,
      description: flow.description,
    });
    onClose();
  };

  return (
    <Modal
      variant={ModalVariant.large}
      title="Browse Flow Templates"
      isOpen={isOpen}
      onClose={onClose}
      actions={[
        <Button key="close" variant="link" onClick={onClose}>Cancel</Button>,
      ]}
      style={{ maxWidth: '960px' }}
    >
      <p style={{ marginBottom: '12px', color: 'var(--pf-global--Color--200, #6a6e73)', fontSize: '13px' }}>
        Templates are starting points — select one, customize the route, then click Create.
        Your flow is fully independent after creation.
      </p>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
        <SearchInput
          placeholder="Search templates..."
          value={search}
          onChange={(_e, v) => setSearch(v)}
          onClear={() => setSearch('')}
          style={{ flex: 1, minWidth: '200px' }}
        />
        <span style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
          {loading ? 'Loading...' : `Showing ${totalVisible} of ${totalFlows}`}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <Button
          variant={categoryFilter === 'all' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setCategoryFilter('all')}
        >
          All
        </Button>
        {catalog.map(cat => (
          <Button
            key={cat.id}
            variant={categoryFilter === cat.id ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setCategoryFilter(cat.id)}
          >
            {cat.icon} {cat.title}
          </Button>
        ))}
      </div>

      {error && (
        <Alert variant="danger" isInline title={`Failed to load catalog: ${error}`} style={{ marginBottom: '12px' }} />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spinner size="lg" aria-label="Loading templates" />
        </div>
      ) : (
        <div style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: '4px' }}>
          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--pf-global--Color--200, #6a6e73)', padding: '24px' }}>
              No templates match your search.
            </p>
          ) : (
            filtered.map(cat => (
              <div key={cat.id} style={{ marginBottom: '20px' }}>
                <Title headingLevel="h4" size="md" style={{ marginBottom: '8px' }}>
                  {cat.icon} {cat.title} ({cat.flows.length})
                </Title>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '8px',
                }}>
                  {cat.flows.map(flow => (
                    <div
                      key={flow.name}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelect(cat, flow)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(cat, flow); }}
                      style={{
                        border: '1px solid var(--pf-global--BorderColor--100, #d2d2d2)',
                        borderRadius: '6px',
                        padding: '10px',
                        cursor: 'pointer',
                        background: 'var(--pf-global--BackgroundColor--100, #fff)',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--pf-global--active-color--100, #2b9af3)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--pf-global--BorderColor--100, #d2d2d2)'; }}
                    >
                      <div style={{ fontSize: '11px', color: 'var(--pf-global--active-color--100, #2b9af3)', fontWeight: 600, marginBottom: '4px' }}>
                        {flow.pattern}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{flow.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)', marginBottom: '6px', lineHeight: 1.4 }}>
                        {flow.description}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        <span style={{
                          fontSize: '10px', padding: '1px 6px', borderRadius: '999px',
                          background: 'var(--pf-global--BackgroundColor--200, #f0f0f0)',
                          fontWeight: 600,
                        }}>
                          {flow.type}
                        </span>
                        {flow.components.split(', ').slice(0, 3).map(c => (
                          <span key={c} style={{
                            fontSize: '10px', padding: '1px 6px', borderRadius: '999px',
                            background: 'var(--pf-global--palette--blue-50, #e7f1fa)',
                            color: 'var(--pf-global--palette--blue-600, #004368)',
                          }}>
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  );
};

export default TemplateCatalogModal;
