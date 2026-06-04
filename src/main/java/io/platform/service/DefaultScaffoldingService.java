package io.platform.service;

import io.platform.api.v1alpha1.EngineType;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

@ApplicationScoped
public class DefaultScaffoldingService implements ScaffoldingService {

    private static final Logger LOG = Logger.getLogger(DefaultScaffoldingService.class);

    @Override
    public ScaffoldResult scaffold(EngineType engine, String kaotoDesign) {
        LOG.infof("Scaffolding project for engine=%s", engine);

        String pomXml;
        String workflowDef;

        if (engine == EngineType.CAMEL) {
            pomXml = generateCamelPom();
            workflowDef = kaotoDesign;
        } else {
            pomXml = generateSonataFlowPom();
            workflowDef = kaotoDesign;
        }

        String summary = String.format("Generated %s project with %d bytes of workflow definition",
                engine, kaotoDesign != null ? kaotoDesign.length() : 0);

        return new ScaffoldResult(pomXml, workflowDef, summary);
    }

    private String generateCamelPom() {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <project xmlns="http://maven.apache.org/POM/4.0.0"
                         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
                    <modelVersion>4.0.0</modelVersion>
                    <groupId>io.platform.workers</groupId>
                    <artifactId>camel-worker</artifactId>
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
                """;
    }

    private String generateSonataFlowPom() {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <project xmlns="http://maven.apache.org/POM/4.0.0"
                         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
                    <modelVersion>4.0.0</modelVersion>
                    <groupId>io.platform.workers</groupId>
                    <artifactId>sonataflow-worker</artifactId>
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
                """;
    }
}
