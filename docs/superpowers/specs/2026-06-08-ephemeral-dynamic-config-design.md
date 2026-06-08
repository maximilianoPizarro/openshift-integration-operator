# Ephemeral Dynamic Config — Design Spec

**Date**: 2026-06-08
**Status**: Approved

## Problem

Ephemeral worker pods only receive a `flow.camel.yaml` ConfigMap today. They lack:
1. **Per-component required properties** — e.g. `camel-worker-full` crashes because `quarkus-infinispan-client` needs `hosts` config at startup
2. **User-supplied properties** — no way to set custom Quarkus/Camel properties from the CR
3. **Secret injection** — `spec.secrets` exists in the CRD but is not wired
4. **Disable/override mechanism** — no way to turn off a global default for a specific flow

## Design

### CRD Changes

Extend `spec.ephemeral` with two new fields and wire the existing `spec.secrets`:

```yaml
spec:
  ephemeral:
    ttlSeconds: 3600
    workerImage: ""                     # existing
    properties:                         # NEW — free-form key-value
      camel.component.kafka.brokers: "my-kafka:9092"
      quarkus.log.level: DEBUG
    disableProperties:                  # NEW — glob patterns to remove
      - "quarkus.infinispan-client.*"
  secrets:                              # EXISTING schema, newly wired
    - name: my-api-credentials
      envFrom: true                     # all keys → env vars
    - name: my-tls-keystore
      mountPath: /etc/certs             # volume mount
      subPath: keystore.p12             # optional single-key mount
```

### Property Merge Pipeline

Properties are assembled in order (last wins):

```
Layer 1 — Worker Image Built-in
  └─ baked into each worker image's application.properties
     (e.g. routes-reload-enabled, routes-include-pattern)

Layer 2 — Component-Required Properties (auto-detected)
  └─ ComponentPropertiesRegistry maps detected Camel components
     to mandatory/default Quarkus + Camel properties
     Values use ${ENV_VAR:fallback} so users supply real values
     via Secrets/env without touching properties

Layer 3 — Scaffold-Generated Properties
  └─ OTel endpoint, resilience (retry, circuit breaker, throttle)
     from spec.resilience — today generated but discarded for
     ephemeral CAMEL_ROUTE; this design mounts them

Layer 4 — User Explicit Properties
  └─ spec.ephemeral.properties map — direct overrides

Layer 5 — Disable Filter
  └─ spec.ephemeral.disableProperties glob list removes matching
     keys from the merged result (e.g. "quarkus.infinispan-client.*")
```

### ComponentPropertiesRegistry

Static Java registry mapping Camel component schemes to required properties:

```java
@ApplicationScoped
public class ComponentPropertiesRegistry {

    private static final Map<String, Map<String, String>> REGISTRY = Map.ofEntries(
        // Messaging
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

        // Data
        entry("sql", Map.of(
            "quarkus.datasource.jdbc.url",
                "${DATASOURCE_URL:jdbc:postgresql://localhost:5432/db}",
            "quarkus.datasource.db-kind", "${DATASOURCE_KIND:postgresql}")),
        entry("mongodb", Map.of(
            "camel.component.mongodb.host",
                "${MONGODB_HOST:localhost}",
            "camel.component.mongodb.port", "${MONGODB_PORT:27017}")),
        entry("elasticsearch", Map.of(
            "camel.component.elasticsearch.host-addresses",
                "${ELASTICSEARCH_HOSTS:localhost:9200}")),

        // Cache / Spring Redis → Infinispan transitive
        entry("spring-redis", Map.of(
            "quarkus.infinispan-client.hosts",
                "${INFINISPAN_HOSTS:localhost:11222}",
            "quarkus.infinispan-client.devservices.enabled", "false",
            "quarkus.infinispan-client.health.enabled", "false",
            "quarkus.infinispan-client.use-auth", "false")),

        // Healthcare
        entry("fhir", Map.of(
            "hapi.fhir.server.url",
                "${FHIR_SERVER_URL:http://localhost:8090/fhir}")),

        // Cloud — AWS
        entry("aws2-s3", Map.of(
            "camel.component.aws2-s3.region",
                "${AWS_REGION:us-east-1}")),
        entry("aws2-sqs", Map.of(
            "camel.component.aws2-sqs.region",
                "${AWS_REGION:us-east-1}")),

        // Observability (always injected from scaffold)
        entry("_otel", Map.of(
            "quarkus.opentelemetry.enabled", "true",
            "quarkus.opentelemetry.tracer.exporter.otlp.endpoint",
                "${OTEL_EXPORTER_OTLP_ENDPOINT:http://otel-collector:4317}"))
    );

    public Map<String, String> resolveFor(Set<String> detectedComponents) {
        Map<String, String> merged = new LinkedHashMap<>();
        merged.putAll(REGISTRY.getOrDefault("_otel", Map.of()));
        for (String comp : detectedComponents) {
            merged.putAll(REGISTRY.getOrDefault(comp, Map.of()));
        }
        return merged;
    }
}
```

### Secret Wiring in CamelRouteEphemeralDeployer

```java
// For each spec.secrets entry:
if (secretRef.isEnvFrom()) {
    // envFrom: secretRef on the container
    container.addEnvFrom(new EnvFromSourceBuilder()
        .withNewSecretRef(secretRef.getName(), false).build());
} else {
    // Volume mount at mountPath
    volumes.add(new VolumeBuilder()
        .withName("secret-" + secretRef.getName())
        .withSecret(new SecretVolumeSourceBuilder()
            .withSecretName(secretRef.getName())
            .withDefaultMode(420).build())
        .build());
    container.addVolumeMount(new VolumeMountBuilder()
        .withName("secret-" + secretRef.getName())
        .withMountPath(secretRef.getMountPath())
        .withSubPath(secretRef.getSubPath())
        .withReadOnly(true).build());
}
```

### Vault Support

No sidecar. Three mechanisms available to users:

1. **Kubernetes Secret** — `spec.secrets` with `envFrom: true`, properties use `${SECRET_KEY}`
2. **External Secrets Operator** — ExternalSecret CRs sync vault → K8s Secret, referenced via `spec.secrets`
3. **Camel Vault Components** — `hashicorp-vault:`, `aws-secrets-manager:`, `azure-key-vault:` components in route YAML; registry auto-injects base URL properties

### ConfigMap Structure (post-merge)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: iflow-my-flow-sources
data:
  flow.camel.yaml: |
    # ... route YAML ...
  application.properties: |
    # Layer 1 override
    camel.main.routes-reload-enabled=true
    camel.main.routes-include-pattern=file:/deployments/config/flow.camel.yaml
    # Layer 2 - auto-detected
    quarkus.opentelemetry.enabled=true
    camel.component.kafka.brokers=${KAFKA_BOOTSTRAP:localhost:9092}
    # Layer 3 - scaffold resilience
    camel.component.microprofile-fault-tolerance...
    # Layer 4 - user overrides
    quarkus.log.level=DEBUG
    # Layer 5 applied: removed quarkus.infinispan-client.* entries
```

### Catalog Integration

The existing template catalog already has integration types. Each catalog entry can optionally define `requiredSecrets` in a comment or annotation that the UI can surface when creating an ephemeral flow from the catalog:

```yaml
# catalog annotation
metadata:
  annotations:
    platform.io/required-secrets: "KAFKA_BOOTSTRAP,KAFKA_SASL_USERNAME,KAFKA_SASL_PASSWORD"
    platform.io/required-properties: "camel.component.kafka.security-protocol=SASL_SSL"
```

The console plugin reads these annotations to prompt the user for secrets before deploying.

## Files to Change

| File | Change |
|------|--------|
| `EphemeralSpec.java` | Add `properties: Map<String,String>`, `disableProperties: List<String>` |
| `integrationflows.platform.io-v1.crd.yml` | Add properties/disableProperties to ephemeral schema |
| `ComponentPropertiesRegistry.java` | **NEW** — component→properties registry |
| `EphemeralConfigMerger.java` | **NEW** — 5-layer merge pipeline |
| `CamelRouteEphemeralDeployer.java` | Use merger for ConfigMap, wire `spec.secrets` |
| `CamelTestEphemeralDeployer.java` | Use merger (already mounts application.properties) |
| `DefaultScaffoldingService.java` | Expose generated application.properties for ephemeral use |
| `SecretRef.java` | Already exists — no changes needed |
| `IntegrationFlowReconciler.java` | Pass spec.secrets to deployers |
| Console plugin create flow modal | Show required secrets from catalog annotations |

## Out of Scope

- Sidecar vault agents
- Dynamic secret rotation (handled by External Secrets Operator)
- Per-component Quarkus extension disablement (Quarkus does not support this at runtime)
