package io.platform.service;

import io.platform.api.v1alpha1.IntegrationType;
import io.platform.api.v1alpha1.ResilienceSpec;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.Set;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@ApplicationScoped
public class DefaultScaffoldingService implements ScaffoldingService {

    private static final Logger LOG = Logger.getLogger(DefaultScaffoldingService.class);
    private static final String DEFAULT_FLOW_NAME = "integration-flow";

    @Inject
    CamelComponentDetector componentDetector;

    private static final Pattern YAML_ID_PATTERN = Pattern.compile("(?m)^\\s*id:\\s*['\"]?([^'\"\\s\\n]+)");
    private static final Pattern JSON_ID_PATTERN = Pattern.compile("\"id\"\\s*:\\s*\"([^\"]+)\"");

    @Override
    public ScaffoldResult scaffold(IntegrationType type, String kaotoDesign) {
        return scaffold(type, kaotoDesign, null);
    }

    @Override
    public ScaffoldResult scaffold(IntegrationType type, String kaotoDesign, ResilienceSpec resilience) {
        if (type == null) type = IntegrationType.CAMEL_ROUTE;
        LOG.infof("Scaffolding project for integrationType=%s", type);

        String flowName = extractFlowName(kaotoDesign);
        String pomXml = generatePom(type, flowName);
        String workflowDef = generateWorkflowDefinition(type, flowName, kaotoDesign);
        String kaotoConfig = generateKaotoConfig(flowName, type);
        String otelDecorator = type.isCamel()
                ? generateCamelOtelDecorator()
                : generateSonataFlowOtelDecorator();
        String kustomizeBase = GitOpsManifestGenerator.kustomization(flowName, type);
        String applicationProperties = generateApplicationProperties(flowName, resilience);
        Set<String> detectedComponents = componentDetector.detectComponents(kaotoDesign);

        String summary = String.format(
                "Generated %s project '%s' with pom.xml, workflow definition (%d bytes), kaoto-config.json, "
                        + "KaotoOtelDecorator.java, base/kustomization.yaml, application.properties",
                type, flowName, kaotoDesign != null ? kaotoDesign.length() : 0);

        String dockerfile = generateDockerfileJvm();

        return new ScaffoldResult(
                pomXml, workflowDef, summary, kaotoConfig, otelDecorator, kustomizeBase, applicationProperties,
                detectedComponents, dockerfile);
    }

    static String generateDockerfileJvm() {
        // Tekton build-maven produces target/quarkus-app; image stage only packages the runtime.
        return """
                FROM registry.access.redhat.com/ubi9/openjdk-21-runtime:1.20
                COPY target/quarkus-app /deployments/
                EXPOSE 8080
                ENV JAVA_OPTS_APPEND="-Dquarkus.http.host=0.0.0.0"
                CMD ["java", "-jar", "/deployments/quarkus-run.jar"]
                """;
    }

    private String generateWorkflowDefinition(IntegrationType type, String flowName, String kaotoDesign) {
        if (kaotoDesign != null && !kaotoDesign.isBlank()) {
            return kaotoDesign;
        }
        return switch (type) {
            case CAMEL_ROUTE -> generateDefaultCamelRoute(flowName);
            case CAMEL_KAMELET -> generateDefaultKamelet(flowName);
            case CAMEL_PIPE -> generateDefaultPipe(flowName);
            case CAMEL_TEST -> generateDefaultTestCase(flowName);
            case SONATAFLOW -> "";
        };
    }

    private String generateDefaultCamelRoute(String flowName) {
        return """
                - route:
                    id: %s
                    from:
                      uri: "timer:tick?period=5000"
                    steps:
                      - log:
                          message: "Hello from %s"
                """.formatted(flowName, flowName);
    }

    private String generateDefaultKamelet(String flowName) {
        return """
                apiVersion: camel.apache.org/v1
                kind: Kamelet
                metadata:
                  name: %s
                  labels:
                    camel.apache.org/kamelet.type: source
                spec:
                  definition:
                    title: Custom Source
                    description: A custom Kamelet source connector
                    properties:
                      message:
                        title: Message
                        description: The message to produce
                        type: string
                        default: "Hello from Kamelet"
                  template:
                    from:
                      uri: "timer:tick?period=5000"
                      steps:
                        - setBody:
                            simple: "{{message}}"
                        - to: "kamelet:sink"
                """.formatted(flowName);
    }

    private String generateDefaultPipe(String flowName) {
        return """
                apiVersion: camel.apache.org/v1
                kind: Pipe
                metadata:
                  name: %s
                spec:
                  source:
                    ref:
                      apiVersion: camel.apache.org/v1
                      kind: Kamelet
                      name: timer-source
                    properties:
                      message: "Hello from Pipe"
                      period: 5000
                  sink:
                    ref:
                      apiVersion: camel.apache.org/v1
                      kind: Kamelet
                      name: log-sink
                    properties:
                      showHeaders: true
                """.formatted(flowName);
    }

    private String generateDefaultTestCase(String flowName) {
        return """
                apiVersion: camel.apache.org/v1
                kind: TestCase
                metadata:
                  name: %s
                spec:
                  description: "Verify the Camel route processes messages correctly"
                  source:
                    uri: "direct:test-input"
                    body: '{"event":"test","timestamp":"2026-01-01T00:00:00Z"}'
                  assertions:
                    - endpoint: "mock:test-output"
                      expectedCount: 1
                      body:
                        contains: "test"
                  timeout: 30000
                """.formatted(flowName);
    }

    private String extractFlowName(String kaotoDesign) {
        if (kaotoDesign == null || kaotoDesign.isBlank()) {
            return DEFAULT_FLOW_NAME;
        }

        Matcher yamlMatcher = YAML_ID_PATTERN.matcher(kaotoDesign);
        if (yamlMatcher.find()) {
            return sanitizeFlowName(yamlMatcher.group(1));
        }

        Matcher jsonMatcher = JSON_ID_PATTERN.matcher(kaotoDesign);
        if (jsonMatcher.find()) {
            return sanitizeFlowName(jsonMatcher.group(1));
        }

        return DEFAULT_FLOW_NAME;
    }

    private String sanitizeFlowName(String name) {
        String sanitized = name.toLowerCase()
                .replaceAll("[^a-z0-9-]", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
        return sanitized.isBlank() ? DEFAULT_FLOW_NAME : sanitized;
    }

    private String generateKaotoConfig(String flowName, IntegrationType type) {
        return """
                {
                  "schemaVersion": "1.0",
                  "integration": {
                    "name": "%s",
                    "engine": "%s",
                    "integrationType": "%s",
                    "version": "0.2.0"
                  },
                  "deployment": {
                    "namespace": "openshift-integration",
                    "replicas": 1,
                    "resources": {
                      "requests": { "cpu": "100m", "memory": "256Mi" },
                      "limits": { "cpu": "500m", "memory": "512Mi" }
                    }
                  },
                  "telemetry": {
                    "enabled": true,
                    "otelEndpoint": "http://integration-otel-collector:4317"
                  }
                }
                """.formatted(flowName, type.toEngineType().name(), type.name());
    }

    private String generateCamelOtelDecorator() {
        return """
                package io.platform.integration;

                import io.opentelemetry.api.trace.Span;
                import jakarta.enterprise.context.ApplicationScoped;
                import org.apache.camel.Exchange;
                import org.apache.camel.spi.CamelEvent;

                /**
                 * Enriches OpenTelemetry spans with Kaoto design metadata so traces
                 * can be correlated back to the visual nodes in the designer.
                 */
                @ApplicationScoped
                public class KaotoOtelDecorator {

                    public void enrich(Exchange exchange) {
                        Span span = Span.current();
                        span.setAttribute("kaoto.node.id", exchange.getFromRouteId());
                        span.setAttribute("kaoto.flow.name", exchange.getContext().getName());
                    }
                }
                """;
    }

    private String generateSonataFlowOtelDecorator() {
        return """
                package io.platform.integration;

                import jakarta.enterprise.context.ApplicationScoped;

                /** Placeholder for future SonataFlow OpenTelemetry span customization. */
                @ApplicationScoped
                public class KaotoOtelDecorator {
                }
                """;
    }

    private String generateApplicationProperties(String flowName, ResilienceSpec resilience) {
        var sb = new StringBuilder();
        sb.append("quarkus.application.name=%s\n".formatted(flowName));
        sb.append("quarkus.opentelemetry.enabled=true\n");
        sb.append("quarkus.opentelemetry.tracer.exporter.otlp.endpoint=http://integration-otel-collector:4317\n");
        sb.append("quarkus.log.level=INFO\n");
        sb.append("quarkus.http.port=8080\n");

        if (resilience != null) {
            if (resilience.getRetry() != null) {
                var retry = resilience.getRetry();
                sb.append("\n# Resilience - Retry Policy\n");
                sb.append("camel.resilience4j.retry.max-attempts=%d\n".formatted(
                        retry.getMaxAttempts() != null ? retry.getMaxAttempts() : 3));
                sb.append("camel.resilience4j.retry.wait-duration=%s\n".formatted(
                        retry.getInitialDelay() != null ? retry.getInitialDelay() : "1s"));
            }
            if (resilience.getCircuitBreaker() != null) {
                var cb = resilience.getCircuitBreaker();
                sb.append("\n# Resilience - Circuit Breaker\n");
                sb.append("camel.resilience4j.circuit-breaker.failure-rate-threshold=%d\n".formatted(
                        cb.getFailureThreshold() != null ? cb.getFailureThreshold() * 20 : 50));
                sb.append("camel.resilience4j.circuit-breaker.wait-duration-in-open-state=%s\n".formatted(
                        cb.getHalfOpenAfter() != null ? cb.getHalfOpenAfter() : "30s"));
            }
            if (resilience.getMaxInflightExchanges() != null) {
                sb.append("\n# Resilience - Throttling\n");
                sb.append("platform.throttle.max-inflight=%d\n".formatted(resilience.getMaxInflightExchanges()));
            }
        }

        return sb.toString();
    }

    private String generatePom(IntegrationType type, String flowName) {
        return switch (type) {
            case CAMEL_ROUTE -> generateCamelRoutePom(flowName);
            case CAMEL_KAMELET -> generateCamelKameletPom(flowName);
            case CAMEL_PIPE -> generateCamelPipePom(flowName);
            case CAMEL_TEST -> generateCamelTestPom(flowName);
            case SONATAFLOW -> generateSonataFlowPom(flowName);
        };
    }

    private static final String POM_JAVA_PROPERTIES = """
                        <maven.compiler.release>17</maven.compiler.release>
                        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>""";

    private static final String POM_BUILD_BLOCK = """
                    <build>
                        <plugins>
                            <plugin>
                                <groupId>io.quarkus.platform</groupId>
                                <artifactId>quarkus-maven-plugin</artifactId>
                                <version>${quarkus.platform.version}</version>
                                <extensions>true</extensions>
                                <executions>
                                    <execution>
                                        <goals>
                                            <goal>build</goal>
                                        </goals>
                                    </execution>
                                </executions>
                            </plugin>
                        </plugins>
                    </build>""";

    private static final String CAMEL_BOM_BLOCK = """
                        <dependency>
                            <groupId>io.quarkus.platform</groupId>
                            <artifactId>quarkus-bom</artifactId>
                            <version>${quarkus.platform.version}</version>
                            <type>pom</type>
                            <scope>import</scope>
                        </dependency>
                        <dependency>
                            <groupId>io.quarkus.platform</groupId>
                            <artifactId>quarkus-camel-bom</artifactId>
                            <version>${quarkus.platform.version}</version>
                            <type>pom</type>
                            <scope>import</scope>
                        </dependency>""";

    private String generateCamelRoutePom(String flowName) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <project xmlns="http://maven.apache.org/POM/4.0.0"
                         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
                    <modelVersion>4.0.0</modelVersion>
                    <groupId>io.platform.workers</groupId>
                    <artifactId>%s</artifactId>
                    <version>1.0.0-SNAPSHOT</version>
                    <properties>
                        <quarkus.platform.version>3.36.1</quarkus.platform.version>
                %s
                    </properties>
                    <dependencyManagement>
                        <dependencies>
                %s
                        </dependencies>
                    </dependencyManagement>
                    <dependencies>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-core</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-yaml-dsl</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-kubernetes</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>io.quarkus</groupId>
                            <artifactId>quarkus-arc</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>io.quarkus</groupId>
                            <artifactId>quarkus-opentelemetry</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-opentelemetry</artifactId>
                        </dependency>
                    </dependencies>
                %s
                </project>
                """.formatted(flowName, POM_JAVA_PROPERTIES, CAMEL_BOM_BLOCK, POM_BUILD_BLOCK);
    }

    private String generateCamelKameletPom(String flowName) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <project xmlns="http://maven.apache.org/POM/4.0.0"
                         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
                    <modelVersion>4.0.0</modelVersion>
                    <groupId>io.platform.workers</groupId>
                    <artifactId>%s</artifactId>
                    <version>1.0.0-SNAPSHOT</version>
                    <properties>
                        <quarkus.platform.version>3.36.1</quarkus.platform.version>
                %s
                    </properties>
                    <dependencyManagement>
                        <dependencies>
                %s
                        </dependencies>
                    </dependencyManagement>
                    <dependencies>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-core</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-yaml-dsl</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-kubernetes</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-kamelet</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>io.quarkus</groupId>
                            <artifactId>quarkus-arc</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>io.quarkus</groupId>
                            <artifactId>quarkus-opentelemetry</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-opentelemetry</artifactId>
                        </dependency>
                    </dependencies>
                %s
                </project>
                """.formatted(flowName, POM_JAVA_PROPERTIES, CAMEL_BOM_BLOCK, POM_BUILD_BLOCK);
    }

    private String generateCamelPipePom(String flowName) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <project xmlns="http://maven.apache.org/POM/4.0.0"
                         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
                    <modelVersion>4.0.0</modelVersion>
                    <groupId>io.platform.workers</groupId>
                    <artifactId>%s</artifactId>
                    <version>1.0.0-SNAPSHOT</version>
                    <properties>
                        <quarkus.platform.version>3.36.1</quarkus.platform.version>
                %s
                    </properties>
                    <dependencyManagement>
                        <dependencies>
                %s
                        </dependencies>
                    </dependencyManagement>
                    <dependencies>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-core</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-yaml-dsl</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-kubernetes</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-kamelet</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>io.quarkus</groupId>
                            <artifactId>quarkus-arc</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>io.quarkus</groupId>
                            <artifactId>quarkus-opentelemetry</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-opentelemetry</artifactId>
                        </dependency>
                    </dependencies>
                %s
                </project>
                """.formatted(flowName, POM_JAVA_PROPERTIES, CAMEL_BOM_BLOCK, POM_BUILD_BLOCK);
    }

    private String generateCamelTestPom(String flowName) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <project xmlns="http://maven.apache.org/POM/4.0.0"
                         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
                    <modelVersion>4.0.0</modelVersion>
                    <groupId>io.platform.workers</groupId>
                    <artifactId>%s</artifactId>
                    <version>1.0.0-SNAPSHOT</version>
                    <properties>
                        <quarkus.platform.version>3.36.1</quarkus.platform.version>
                %s
                    </properties>
                    <dependencyManagement>
                        <dependencies>
                %s
                        </dependencies>
                    </dependencyManagement>
                    <dependencies>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-core</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-yaml-dsl</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-kubernetes</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-mock</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>io.quarkus</groupId>
                            <artifactId>quarkus-junit5</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>io.quarkus</groupId>
                            <artifactId>quarkus-arc</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>io.quarkus</groupId>
                            <artifactId>quarkus-opentelemetry</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-opentelemetry</artifactId>
                        </dependency>
                    </dependencies>
                %s
                </project>
                """.formatted(flowName, POM_JAVA_PROPERTIES, CAMEL_BOM_BLOCK, POM_BUILD_BLOCK);
    }

    private String generateSonataFlowPom(String flowName) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <project xmlns="http://maven.apache.org/POM/4.0.0"
                         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
                    <modelVersion>4.0.0</modelVersion>
                    <groupId>io.platform.workers</groupId>
                    <artifactId>%s</artifactId>
                    <version>1.0.0-SNAPSHOT</version>
                    <properties>
                        <quarkus.platform.version>3.36.1</quarkus.platform.version>
                %s
                    </properties>
                    <dependencyManagement>
                        <dependencies>
                            <dependency>
                                <groupId>io.quarkus.platform</groupId>
                                <artifactId>quarkus-bom</artifactId>
                                <version>${quarkus.platform.version}</version>
                                <type>pom</type>
                                <scope>import</scope>
                            </dependency>
                            <dependency>
                                <groupId>org.kie.kogito</groupId>
                                <artifactId>kogito-bom</artifactId>
                                <version>10.1.0</version>
                                <type>pom</type>
                                <scope>import</scope>
                            </dependency>
                %s
                        </dependencies>
                    </dependencyManagement>
                    <dependencies>
                        <dependency>
                            <groupId>org.kie.kogito</groupId>
                            <artifactId>kogito-quarkus-serverless-workflow</artifactId>
                            <version>10.1.0</version>
                        </dependency>
                        <dependency>
                            <groupId>org.kie</groupId>
                            <artifactId>kie-addons-quarkus-knative-eventing</artifactId>
                            <version>10.1.0</version>
                        </dependency>
                        <dependency>
                            <groupId>io.quarkus</groupId>
                            <artifactId>quarkus-arc</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>io.quarkus</groupId>
                            <artifactId>quarkus-opentelemetry</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.apache.camel.quarkus</groupId>
                            <artifactId>camel-quarkus-opentelemetry</artifactId>
                        </dependency>
                    </dependencies>
                %s
                </project>
                """.formatted(flowName, POM_JAVA_PROPERTIES, CAMEL_BOM_BLOCK, POM_BUILD_BLOCK);
    }
}
