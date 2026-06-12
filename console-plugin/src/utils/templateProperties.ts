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

/** Shared OpenAI-compatible LLM keys (OpenAI, MaaS, Azure via base-url, Ollama /v1). */
const OPENAI_CHAT_PROPERTIES: Record<string, string> = {
  'quarkus.langchain4j.openai.api-key': '${OPENAI_API_KEY}',
  'quarkus.langchain4j.openai.base-url': '${OPENAI_BASE_URL:https://api.openai.com/v1}',
  'quarkus.langchain4j.openai.chat-model.model-name': '${OPENAI_MODEL:gpt-4o-mini}',
  'quarkus.langchain4j.openai.chat-model.temperature': '0.7',
  'quarkus.langchain4j.openai.chat-model.max-completion-tokens': '1024',
};

const OPENAI_EMBEDDING_PROPERTIES: Record<string, string> = {
  'quarkus.langchain4j.openai.api-key': '${OPENAI_API_KEY}',
  'quarkus.langchain4j.openai.base-url': '${OPENAI_BASE_URL:https://api.openai.com/v1}',
  'quarkus.langchain4j.openai.embedding-model.model-name': '${OPENAI_EMBEDDING_MODEL:text-embedding-3-small}',
};

const COMPONENT_PROPERTIES: Record<string, ComponentPropertyEntry> = {
  'langchain4j-chat': {
    properties: { ...OPENAI_CHAT_PROPERTIES },
    requiredSecrets: ['OPENAI_API_KEY'],
    hint: 'OpenAI-compatible API: set base-url (MaaS, Azure, Ollama /v1), api-key, and model-name.',
  },
  'langchain4j-embeddings': {
    properties: { ...OPENAI_EMBEDDING_PROPERTIES },
    requiredSecrets: ['OPENAI_API_KEY'],
    hint: 'Embeddings use the same base-url and api-key as chat models.',
  },
  'langchain4j-web-search': {
    properties: {
      ...OPENAI_CHAT_PROPERTIES,
      TAVILY_API_KEY: '${TAVILY_API_KEY}',
    },
    requiredSecrets: ['OPENAI_API_KEY', 'TAVILY_API_KEY'],
  },
  kafka: {
    properties: { 'camel.component.kafka.brokers': '${KAFKA_BOOTSTRAP:kafka-broker:9092}' },
    requiredSecrets: ['KAFKA_BOOTSTRAP'],
    hint: 'Kafka bootstrap servers (host:port).',
  },
  amqp: {
    properties: { 'camel.component.amqp.connection-factory.remote-url': '${AMQP_URL:amqp://localhost:5672}' },
  },
  activemq: {
    properties: { 'camel.component.activemq.broker-url': '${ACTIVEMQ_URL:tcp://localhost:61616}' },
  },
  'paho-mqtt5': {
    properties: { 'camel.component.paho-mqtt5.broker-url': '${MQTT_BROKER_URL:tcp://localhost:1883}' },
  },
  nats: {
    properties: { 'camel.component.nats.servers': '${NATS_URL:nats://localhost:4222}' },
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
    properties: { 'camel.component.elasticsearch.host-addresses': '${ELASTICSEARCH_HOSTS:elasticsearch:9200}' },
    hint: 'Elasticsearch host:port for indexing/search steps.',
  },
  'elasticsearch-rest-client': {
    properties: { 'camel.component.elasticsearch.host-addresses': '${ELASTICSEARCH_HOSTS:elasticsearch:9200}' },
    hint: 'Elasticsearch host:port for indexing/search steps.',
  },
  'spring-redis': {
    properties: {
      'quarkus.infinispan-client.hosts': '${REDIS_HOST:redis-server:6379}',
      'quarkus.infinispan-client.devservices.enabled': 'false',
    },
    hint: 'Redis/Infinispan host for cache-backed routes.',
  },
  'aws2-s3': {
    properties: { 'camel.component.aws2-s3.region': '${AWS_REGION:us-east-1}' },
    requiredSecrets: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
  },
  'aws2-sqs': {
    properties: { 'camel.component.aws2-sqs.region': '${AWS_REGION:us-east-1}' },
    requiredSecrets: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
  },
  'aws2-sns': {
    properties: { 'camel.component.aws2-sns.region': '${AWS_REGION:us-east-1}' },
    requiredSecrets: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
  },
  'azure-storage-blob': {
    properties: { 'camel.component.azure-storage-blob.account-name': '${AZURE_STORAGE_ACCOUNT:}' },
    requiredSecrets: ['AZURE_STORAGE_ACCOUNT'],
  },
  'azure-eventhubs': {
    properties: { 'camel.component.azure-eventhubs.connection-string': '${AZURE_EVENTHUBS_CONNECTION_STRING:}' },
    requiredSecrets: ['AZURE_EVENTHUBS_CONNECTION_STRING'],
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
    hint: 'Qdrant vector store host/port for RAG templates.',
  },
  'hashicorp-vault': {
    properties: {
      'camel.component.hashicorp-vault.host': '${VAULT_ADDR:http://localhost:8200}',
      'camel.component.hashicorp-vault.token': '${VAULT_TOKEN:}',
    },
    requiredSecrets: ['VAULT_TOKEN'],
  },
  ftp: {
    properties: {
      'camel.component.ftp.host': '${FTP_HOST:localhost}',
      'camel.component.ftp.port': '${FTP_PORT:21}',
    },
  },
};

/** Catalog uses alternate scheme names — map to registry keys before lookup. */
const COMPONENT_ALIASES: Record<string, string> = {
  redis: 'spring-redis',
};

const SECRET_NAME_BY_KEY: Record<string, string> = {
  OPENAI_API_KEY: 'openai-credentials',
  OPENAI_MODEL: 'openai-credentials',
  OPENAI_BASE_URL: 'openai-credentials',
  OPENAI_EMBEDDING_MODEL: 'openai-credentials',
  TAVILY_API_KEY: 'tavily-credentials',
  KAFKA_BOOTSTRAP: 'kafka-credentials',
  DATASOURCE_URL: 'datasource-credentials',
  DATASOURCE_USERNAME: 'datasource-credentials',
  DATASOURCE_PASSWORD: 'datasource-credentials',
  AWS_ACCESS_KEY_ID: 'aws-credentials',
  AWS_SECRET_ACCESS_KEY: 'aws-credentials',
  SLACK_WEBHOOK_URL: 'slack-credentials',
  ELASTICSEARCH_HOSTS: 'elasticsearch-credentials',
  QDRANT_HOST: 'qdrant-credentials',
  REDIS_HOST: 'redis-credentials',
};

function parseComponentSchemes(components: string): string[] {
  return components
    .split(/[,\s]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function resolveSchemeEntry(scheme: string): ComponentPropertyEntry | undefined {
  const key = COMPONENT_ALIASES[scheme] ?? scheme;
  return COMPONENT_PROPERTIES[key] ?? COMPONENT_PROPERTIES[scheme];
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
    const entry = resolveSchemeEntry(scheme);
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
