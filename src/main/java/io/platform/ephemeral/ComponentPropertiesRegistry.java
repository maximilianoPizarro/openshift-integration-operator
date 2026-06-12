package io.platform.ephemeral;

import jakarta.enterprise.context.ApplicationScoped;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import static java.util.Map.entry;

/**
 * Maps detected Camel component schemes to the Quarkus/Camel properties
 * required for the worker to start successfully.
 * <p>
 * Values use {@code ${ENV_VAR:fallback}} syntax so real credentials can be
 * supplied via {@code spec.secrets} (envFrom) without editing properties.
 */
@ApplicationScoped
public class ComponentPropertiesRegistry {

    private static final Map<String, Map<String, String>> REGISTRY = Map.ofEntries(

            // ── Messaging ──────────────────────────────────────────────
            entry("kafka", Map.of(
                    "camel.component.kafka.brokers", "${KAFKA_BOOTSTRAP:localhost:9092}")),
            entry("amqp", Map.of(
                    "camel.component.amqp.connection-factory.remote-url",
                            "${AMQP_URL:amqp://localhost:5672}")),
            entry("activemq", Map.of(
                    "camel.component.activemq.broker-url",
                            "${ACTIVEMQ_URL:tcp://localhost:61616}")),
            entry("paho-mqtt5", Map.of(
                    "camel.component.paho-mqtt5.broker-url",
                            "${MQTT_BROKER_URL:tcp://localhost:1883}")),
            entry("nats", Map.of(
                    "camel.component.nats.servers",
                            "${NATS_URL:nats://localhost:4222}")),

            // ── Data / Persistence ─────────────────────────────────────
            entry("sql", Map.of(
                    "quarkus.datasource.jdbc.url",
                            "${DATASOURCE_URL:jdbc:postgresql://localhost:5432/db}",
                    "quarkus.datasource.db-kind", "${DATASOURCE_KIND:postgresql}",
                    "quarkus.datasource.username", "${DATASOURCE_USERNAME:postgres}",
                    "quarkus.datasource.password", "${DATASOURCE_PASSWORD:postgres}")),
            entry("jdbc", Map.of(
                    "quarkus.datasource.jdbc.url",
                            "${DATASOURCE_URL:jdbc:postgresql://localhost:5432/db}")),
            entry("mongodb", Map.of(
                    "camel.component.mongodb.host", "${MONGODB_HOST:localhost}",
                    "camel.component.mongodb.port", "${MONGODB_PORT:27017}")),
            entry("elasticsearch", Map.of(
                    "camel.component.elasticsearch.host-addresses",
                            "${ELASTICSEARCH_HOSTS:localhost:9200}")),
            entry("cassandraql", Map.of(
                    "camel.component.cql.host", "${CASSANDRA_HOST:localhost}",
                    "camel.component.cql.port", "${CASSANDRA_PORT:9042}")),

            // ── Cache (Infinispan transitive via spring-redis) ─────────
            entry("spring-redis", Map.of(
                    "quarkus.infinispan-client.hosts",
                            "${INFINISPAN_HOSTS:localhost:11222}",
                    "quarkus.infinispan-client.devservices.enabled", "false",
                    "quarkus.infinispan-client.health.enabled", "false",
                    "quarkus.infinispan-client.use-auth", "false")),

            // ── Healthcare ─────────────────────────────────────────────
            entry("fhir", Map.of(
                    "hapi.fhir.server.url",
                            "${FHIR_SERVER_URL:http://localhost:8090/fhir}")),

            // ── Cloud — AWS ────────────────────────────────────────────
            entry("aws2-s3", Map.of(
                    "camel.component.aws2-s3.region", "${AWS_REGION:us-east-1}")),
            entry("aws2-sqs", Map.of(
                    "camel.component.aws2-sqs.region", "${AWS_REGION:us-east-1}")),
            entry("aws2-sns", Map.of(
                    "camel.component.aws2-sns.region", "${AWS_REGION:us-east-1}")),
            entry("aws2-ddb", Map.of(
                    "camel.component.aws2-ddb.region", "${AWS_REGION:us-east-1}")),
            entry("aws2-lambda", Map.of(
                    "camel.component.aws2-lambda.region", "${AWS_REGION:us-east-1}")),
            entry("aws2-kinesis", Map.of(
                    "camel.component.aws2-kinesis.region", "${AWS_REGION:us-east-1}")),

            // ── Cloud — Azure ──────────────────────────────────────────
            entry("azure-storage-blob", Map.of(
                    "camel.component.azure-storage-blob.account-name",
                            "${AZURE_STORAGE_ACCOUNT:}")),
            entry("azure-eventhubs", Map.of(
                    "camel.component.azure-eventhubs.connection-string",
                            "${AZURE_EVENTHUBS_CONNECTION_STRING:}")),

            // ── Vault components (route-level, need base URL) ──────────
            entry("hashicorp-vault", Map.of(
                    "camel.component.hashicorp-vault.host",
                            "${VAULT_ADDR:http://localhost:8200}",
                    "camel.component.hashicorp-vault.token",
                            "${VAULT_TOKEN:}")),

            // ── SaaS / Integration ─────────────────────────────────────
            entry("salesforce", Map.of(
                    "camel.component.salesforce.login-url",
                            "${SALESFORCE_LOGIN_URL:https://login.salesforce.com}")),
            entry("slack", Map.of(
                    "camel.component.slack.webhook-url", "${SLACK_WEBHOOK_URL:}")),

            // ── FTP ────────────────────────────────────────────────────
            entry("ftp", Map.of(
                    "camel.component.ftp.host", "${FTP_HOST:localhost}",
                    "camel.component.ftp.port", "${FTP_PORT:21}")),

            // ── AI / LangChain4j ───────────────────────────────────────
            entry("langchain4j-chat", Map.of(
                    "quarkus.langchain4j.openai.api-key", "${OPENAI_API_KEY:}",
                    "quarkus.langchain4j.openai.chat-model.model-name",
                            "${OPENAI_MODEL:gpt-4o-mini}")),
            entry("langchain4j-embeddings", Map.of(
                    "quarkus.langchain4j.openai.api-key", "${OPENAI_API_KEY:}",
                    "quarkus.langchain4j.openai.embedding-model.model-name",
                            "${OPENAI_EMBEDDING_MODEL:text-embedding-3-small}"))
    );

    /**
     * Resolves the required properties for the given set of detected Camel components.
     * Always includes OTel baseline. Each property uses env-var placeholders
     * so actual values arrive via {@code spec.secrets[].envFrom: true}.
     */
    public Map<String, String> resolveFor(Set<String> detectedComponents) {
        Map<String, String> merged = new LinkedHashMap<>();
        for (String comp : detectedComponents) {
            merged.putAll(REGISTRY.getOrDefault(comp, Map.of()));
        }
        return merged;
    }
}
