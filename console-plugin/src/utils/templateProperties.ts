/**
 * Minimal worker properties per Camel component scheme — mirrors operator
 * ComponentPropertiesRegistry for console create-form prefill.
 */

export interface TemplatePropertyConfig {
  properties: Record<string, string>;
  requiredSecrets: string[];
  defaultSecretName: string;
  hints: string[];
}

interface ComponentPropertyEntry {
  properties: Record<string, string>;
  requiredSecrets?: string[];
  hint?: string;
}

const COMPONENT_PROPERTIES: Record<string, ComponentPropertyEntry> = {
  'langchain4j-chat': {
    properties: {
      'quarkus.langchain4j.openai.api-key': '${OPENAI_API_KEY}',
      'quarkus.langchain4j.openai.chat-model.model-name': '${OPENAI_MODEL:gpt-4o-mini}',
      'quarkus.langchain4j.openai.chat-model.temperature': '0.7',
      'quarkus.langchain4j.openai.chat-model.max-completion-tokens': '1024',
    },
    requiredSecrets: ['OPENAI_API_KEY'],
    hint: 'OpenAI-compatible API key via Secret (envFrom).',
  },
  'langchain4j-embeddings': {
    properties: {
      'quarkus.langchain4j.openai.api-key': '${OPENAI_API_KEY}',
      'quarkus.langchain4j.openai.embedding-model.model-name': '${OPENAI_EMBEDDING_MODEL:text-embedding-3-small}',
    },
    requiredSecrets: ['OPENAI_API_KEY'],
  },
  'langchain4j-web-search': {
    properties: {
      'quarkus.langchain4j.openai.api-key': '${OPENAI_API_KEY}',
      TAVILY_API_KEY: '${TAVILY_API_KEY}',
    },
    requiredSecrets: ['OPENAI_API_KEY', 'TAVILY_API_KEY'],
  },
  kafka: {
    properties: { 'camel.component.kafka.brokers': '${KAFKA_BOOTSTRAP:localhost:9092}' },
    requiredSecrets: ['KAFKA_BOOTSTRAP'],
    hint: 'Kafka bootstrap servers.',
  },
  amqp: {
    properties: { 'camel.component.amqp.connection-factory.remote-url': '${AMQP_URL:amqp://localhost:5672}' },
  },
  sql: {
    properties: {
      'quarkus.datasource.jdbc.url': '${DATASOURCE_URL:jdbc:postgresql://localhost:5432/db}',
      'quarkus.datasource.db-kind': '${DATASOURCE_KIND:postgresql}',
      'quarkus.datasource.username': '${DATASOURCE_USERNAME:postgres}',
      'quarkus.datasource.password': '${DATASOURCE_PASSWORD:postgres}',
    },
    requiredSecrets: ['DATASOURCE_URL', 'DATASOURCE_USERNAME', 'DATASOURCE_PASSWORD'],
  },
  jdbc: {
    properties: { 'quarkus.datasource.jdbc.url': '${DATASOURCE_URL:jdbc:postgresql://localhost:5432/db}' },
    requiredSecrets: ['DATASOURCE_URL'],
  },
  mongodb: {
    properties: {
      'camel.component.mongodb.host': '${MONGODB_HOST:localhost}',
      'camel.component.mongodb.port': '${MONGODB_PORT:27017}',
    },
  },
  elasticsearch: {
    properties: { 'camel.component.elasticsearch.host-addresses': '${ELASTICSEARCH_HOSTS:localhost:9200}' },
  },
  'spring-redis': {
    properties: {
      'quarkus.infinispan-client.hosts': '${INFINISPAN_HOSTS:localhost:11222}',
      'quarkus.infinispan-client.devservices.enabled': 'false',
    },
  },
  'aws2-s3': {
    properties: { 'camel.component.aws2-s3.region': '${AWS_REGION:us-east-1}' },
    requiredSecrets: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
  },
  'aws2-sqs': {
    properties: { 'camel.component.aws2-sqs.region': '${AWS_REGION:us-east-1}' },
    requiredSecrets: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
  },
  slack: {
    properties: { 'camel.component.slack.webhook-url': '${SLACK_WEBHOOK_URL:}' },
    requiredSecrets: ['SLACK_WEBHOOK_URL'],
  },
  qdrant: {
    properties: {
      'camel.component.qdrant.host': '${QDRANT_HOST:qdrant-server}',
      'camel.component.qdrant.port': '${QDRANT_PORT:6334}',
    },
    hint: 'Qdrant vector store host/port.',
  },
};

const SECRET_NAME_BY_KEY: Record<string, string> = {
  OPENAI_API_KEY: 'openai-credentials',
  OPENAI_MODEL: 'openai-credentials',
  OPENAI_EMBEDDING_MODEL: 'openai-credentials',
  TAVILY_API_KEY: 'tavily-credentials',
  KAFKA_BOOTSTRAP: 'kafka-credentials',
  DATASOURCE_URL: 'datasource-credentials',
  DATASOURCE_USERNAME: 'datasource-credentials',
  DATASOURCE_PASSWORD: 'datasource-credentials',
  AWS_ACCESS_KEY_ID: 'aws-credentials',
  AWS_SECRET_ACCESS_KEY: 'aws-credentials',
  SLACK_WEBHOOK_URL: 'slack-credentials',
};

function parseComponentSchemes(components: string): string[] {
  return components
    .split(/[,\s]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

export function resolveMinimalTemplateProperties(
  components: string,
  catalogSuggested?: Record<string, string>,
  catalogRequiredSecrets?: string[],
): TemplatePropertyConfig {
  const schemes = parseComponentSchemes(components);
  const properties: Record<string, string> = {};
  const requiredSecrets = new Set<string>();
  const hints: string[] = [];

  for (const scheme of schemes) {
    const entry = COMPONENT_PROPERTIES[scheme];
    if (!entry) continue;
    Object.assign(properties, entry.properties);
    entry.requiredSecrets?.forEach(s => requiredSecrets.add(s));
    if (entry.hint) hints.push(entry.hint);
  }

  if (catalogSuggested) {
    Object.assign(properties, catalogSuggested);
  }
  catalogRequiredSecrets?.forEach(s => requiredSecrets.add(s));

  let defaultSecretName = '';
  for (const key of requiredSecrets) {
    const name = SECRET_NAME_BY_KEY[key];
    if (name) {
      defaultSecretName = name;
      break;
    }
  }

  return {
    properties,
    requiredSecrets: [...requiredSecrets],
    defaultSecretName,
    hints: [...new Set(hints)],
  };
}

export function propertyEntriesToRecord(entries: { key: string; value: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { key, value } of entries) {
    const k = key.trim();
    const v = value.trim();
    if (k && v) out[k] = v;
  }
  return out;
}

export function recordToPropertyEntries(record: Record<string, string>): { key: string; value: string }[] {
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}
