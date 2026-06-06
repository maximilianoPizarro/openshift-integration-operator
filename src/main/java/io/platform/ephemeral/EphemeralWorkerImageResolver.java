package io.platform.ephemeral;

import io.platform.api.v1alpha1.IntegrationType;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Resolves the ephemeral worker image based on detected Camel components.
 * Selects the smallest tier image that covers all required components; falls
 * back to full worker when components span multiple domains.
 */
@ApplicationScoped
public class EphemeralWorkerImageResolver {

    @ConfigProperty(name = "ephemeral.prefer-full-worker", defaultValue = "false")
    boolean preferFullWorker;

    @ConfigProperty(name = "ephemeral.camel-worker-image",
            defaultValue = "quay.io/maximilianopizarro/camel-worker-core:v0.3.0")
    String coreImage;

    @ConfigProperty(name = "ephemeral.camel-worker-messaging-image",
            defaultValue = "quay.io/maximilianopizarro/camel-worker-messaging:v0.3.0")
    String messagingImage;

    @ConfigProperty(name = "ephemeral.camel-worker-http-image",
            defaultValue = "quay.io/maximilianopizarro/camel-worker-http:v0.3.0")
    String httpImage;

    @ConfigProperty(name = "ephemeral.camel-worker-data-image",
            defaultValue = "quay.io/maximilianopizarro/camel-worker-data:v0.3.0")
    String dataImage;

    @ConfigProperty(name = "ephemeral.camel-worker-cloud-image",
            defaultValue = "quay.io/maximilianopizarro/camel-worker-cloud:v0.3.0")
    String cloudImage;

    @ConfigProperty(name = "ephemeral.camel-worker-ai-image",
            defaultValue = "quay.io/maximilianopizarro/camel-worker-ai:v0.3.0")
    String aiImage;

    @ConfigProperty(name = "ephemeral.camel-worker-full-image",
            defaultValue = "quay.io/maximilianopizarro/camel-worker-full:v0.3.0")
    String fullImage;

    @ConfigProperty(name = "ephemeral.camel-test-image",
            defaultValue = "quay.io/maximilianopizarro/camel-test-runner:v0.3.0")
    String testImage;

    private static final Map<String, Set<String>> DOMAIN_COMPONENTS = Map.of(
            "core", Set.of("timer", "log", "direct", "seda", "bean", "yaml-dsl", "mock"),
            "messaging", Set.of("kafka", "amqp", "jms", "activemq", "paho-mqtt5", "mqtt",
                    "nats", "pulsar", "stomp", "aws2-sqs", "aws2-sns", "azure-servicebus",
                    "google-pubsub", "spring-rabbitmq", "disruptor", "knative"),
            "http", Set.of("platform-http", "http", "rest", "vertx-http", "netty-http",
                    "graphql", "grpc", "cxf", "websocket", "vertx-websocket", "coap"),
            "data", Set.of("sql", "jdbc", "jpa", "mongodb", "cassandraql", "couchdb",
                    "infinispan", "redis", "spring-redis", "elasticsearch", "solr", "minio", "file", "ftp", "sftp"),
            "cloud", Set.of("aws2-s3", "aws2-sqs", "aws2-sns", "aws2-ddb", "aws2-lambda",
                    "azure-storage-blob", "azure-cosmosdb", "google-storage", "google-bigquery", "ibm-cos"),
            "ai", Set.of("langchain4j", "djl", "aws-bedrock")
    );

    public String resolveWorkerImage(Set<String> components, IntegrationType type) {
        if (type == IntegrationType.CAMEL_TEST) {
            return testImage;
        }
        if (preferFullWorker) {
            return fullImage;
        }

        List<WorkerTier> tiers = List.of(
                new WorkerTier("core", coreImage, DOMAIN_COMPONENTS.get("core")),
                new WorkerTier("messaging", messagingImage, DOMAIN_COMPONENTS.get("messaging")),
                new WorkerTier("http", httpImage, DOMAIN_COMPONENTS.get("http")),
                new WorkerTier("data", dataImage, DOMAIN_COMPONENTS.get("data")),
                new WorkerTier("cloud", cloudImage, DOMAIN_COMPONENTS.get("cloud")),
                new WorkerTier("ai", aiImage, DOMAIN_COMPONENTS.get("ai"))
        );

        for (WorkerTier tier : tiers) {
            if (tier.covers(components)) {
                return tier.image;
            }
        }
        return fullImage;
    }

    private record WorkerTier(String name, String image, Set<String> supported) {
        boolean covers(Set<String> required) {
            return supported.containsAll(required);
        }
    }
}
