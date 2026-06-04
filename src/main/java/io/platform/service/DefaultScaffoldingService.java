package io.platform.service;

import io.platform.api.v1alpha1.EngineType;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@ApplicationScoped
public class DefaultScaffoldingService implements ScaffoldingService {

    private static final Logger LOG = Logger.getLogger(DefaultScaffoldingService.class);
    private static final String DEFAULT_FLOW_NAME = "integration-flow";

    private static final Pattern YAML_ID_PATTERN = Pattern.compile("(?m)^\\s*id:\\s*['\"]?([^'\"\\s\\n]+)");
    private static final Pattern JSON_ID_PATTERN = Pattern.compile("\"id\"\\s*:\\s*\"([^\"]+)\"");

    @Override
    public ScaffoldResult scaffold(EngineType engine, String kaotoDesign) {
        LOG.infof("Scaffolding project for engine=%s", engine);

        String flowName = extractFlowName(kaotoDesign);
        String pomXml;
        String workflowDef;

        if (engine == EngineType.CAMEL) {
            pomXml = generateCamelPom(flowName);
            workflowDef = kaotoDesign;
        } else {
            pomXml = generateSonataFlowPom(flowName);
            workflowDef = kaotoDesign;
        }

        String kaotoConfig = generateKaotoConfig(flowName, engine);
        String otelDecorator = engine == EngineType.CAMEL
                ? generateCamelOtelDecorator()
                : generateSonataFlowOtelDecorator();
        String kustomizeBase = generateKustomizeBase(flowName);
        String applicationProperties = generateApplicationProperties(flowName);

        String summary = String.format(
                "Generated %s project '%s' with pom.xml, workflow definition (%d bytes), kaoto-config.json, "
                        + "KaotoOtelDecorator.java, base/kustomization.yaml, application.properties",
                engine, flowName, kaotoDesign != null ? kaotoDesign.length() : 0);

        return new ScaffoldResult(
                pomXml, workflowDef, summary, kaotoConfig, otelDecorator, kustomizeBase, applicationProperties);
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

    private String generateKaotoConfig(String flowName, EngineType engine) {
        return """
                {
                  "schemaVersion": "1.0",
                  "integration": {
                    "name": "%s",
                    "engine": "%s",
                    "version": "0.1.0"
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
                    "otelEndpoint": "http://otel-collector:4317"
                  }
                }
                """.formatted(flowName, engine.name());
    }

    private String generateCamelOtelDecorator() {
        return """
                package io.platform.integration;

                import jakarta.enterprise.context.ApplicationScoped;
                import org.apache.camel.Exchange;
                import org.apache.camel.tracing.SpanDecorator;
                import io.opentelemetry.api.trace.Span;

                @ApplicationScoped
                public class KaotoOtelDecorator implements SpanDecorator {
                    @Override
                    public String getComponent() { return "kaoto"; }

                    @Override
                    public void pre(Span span, Exchange exchange, String operationName) {
                        String nodeId = exchange.getProperty("CamelToEndpoint", String.class);
                        if (nodeId == null) nodeId = operationName;
                        span.setAttribute("kaoto.node.id", nodeId);
                        span.setAttribute("kaoto.integration.name",
                            System.getenv().getOrDefault("KAOTO_INTEGRATION_NAME", "unknown"));
                        span.setAttribute("kaoto.canvas.version",
                            System.getenv().getOrDefault("KAOTO_CANVAS_VERSION", "1.0"));
                    }

                    @Override
                    public void post(Span span, Exchange exchange, String operationName) {}
                }
                """;
    }

    private String generateSonataFlowOtelDecorator() {
        return """
                package io.platform.integration;

                import jakarta.enterprise.context.ApplicationScoped;
                import org.apache.camel.Exchange;
                import org.apache.camel.tracing.SpanDecorator;
                import io.opentelemetry.api.trace.Span;

                @ApplicationScoped
                public class KaotoOtelDecorator implements SpanDecorator {
                    @Override
                    public String getComponent() { return "kaoto-sonataflow"; }

                    @Override
                    public void pre(Span span, Exchange exchange, String operationName) {
                        String nodeId = exchange.getIn().getHeader("kogitoNodeInstanceId", String.class);
                        if (nodeId == null) {
                            nodeId = exchange.getIn().getHeader("kogitoReferenceId", String.class);
                        }
                        if (nodeId == null) {
                            nodeId = exchange.getProperty("kogitoProcessInstanceId", String.class);
                        }
                        if (nodeId == null) nodeId = operationName;
                        span.setAttribute("kaoto.node.id", nodeId);
                        span.setAttribute("kaoto.integration.name",
                            System.getenv().getOrDefault("KAOTO_INTEGRATION_NAME", "unknown"));
                        span.setAttribute("kaoto.canvas.version",
                            System.getenv().getOrDefault("KAOTO_CANVAS_VERSION", "1.0"));
                        String stateName = exchange.getIn().getHeader("kogitoProcessReferenceId", String.class);
                        if (stateName != null) {
                            span.setAttribute("sonataflow.state.name", stateName);
                        }
                    }

                    @Override
                    public void post(Span span, Exchange exchange, String operationName) {}
                }
                """;
    }

    private String generateKustomizeBase(String flowName) {
        return """
                apiVersion: kustomize.config.k8s.io/v1beta1
                kind: Kustomization
                resources:
                  - deployment.yaml
                  - service.yaml
                commonLabels:
                  app.kubernetes.io/part-of: integration-platform
                  kaoto.io/integration: "%s"
                """.formatted(flowName);
    }

    private String generateApplicationProperties(String flowName) {
        return """
                quarkus.application.name=%s
                quarkus.opentelemetry.enabled=true
                quarkus.opentelemetry.tracer.exporter.otlp.endpoint=http://otel-collector:4317
                quarkus.log.level=INFO
                quarkus.http.port=8080
                """.formatted(flowName);
    }

    private String generateCamelPom(String flowName) {
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
                            <artifactId>quarkus-opentelemetry</artifactId>
                        </dependency>
                    </dependencies>
                </project>
                """.formatted(flowName);
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
                        </dependencies>
                    </dependencyManagement>
                    <dependencies>
                        <dependency>
                            <groupId>org.kie.kogito</groupId>
                            <artifactId>kogito-quarkus-serverless-workflow</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>org.kie</groupId>
                            <artifactId>kie-addons-quarkus-knative-eventing</artifactId>
                        </dependency>
                        <dependency>
                            <groupId>io.quarkus</groupId>
                            <artifactId>quarkus-opentelemetry</artifactId>
                        </dependency>
                    </dependencies>
                </project>
                """.formatted(flowName);
    }
}
