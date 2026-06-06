#!/usr/bin/env python3
"""Validate examples-catalog.html Camel components against known camel-quarkus extensions."""
import json
import re
import sys
import urllib.request
from pathlib import Path

CATALOG_HTML = Path(__file__).resolve().parent.parent / "docs" / "examples-catalog.html"
KNOWN_EXTENSIONS_URL = (
    "https://raw.githubusercontent.com/apache/camel-quarkus/main/catalog/generated/camel-quarkus-catalog.yaml"
)

# Fallback allowlist when offline (common camel-quarkus 3.36 components)
FALLBACK_COMPONENTS = {
    "timer", "log", "direct", "seda", "bean", "kafka", "amqp", "jms", "activemq",
    "paho-mqtt5", "mqtt", "nats", "pulsar", "stomp", "aws2-sqs", "aws2-sns",
    "azure-servicebus", "google-pubsub", "spring-rabbitmq", "disruptor", "knative",
    "platform-http", "http", "rest", "vertx-http", "netty-http", "graphql", "grpc",
    "cxf", "vertx-websocket", "coap", "sql", "jdbc", "jpa", "mongodb", "cassandraql",
    "couchdb", "infinispan", "spring-redis", "redis", "elasticsearch-rest-client",
    "solr", "aws2-s3", "aws2-ddb", "azure-storage-blob", "azure-cosmosdb",
    "google-storage", "minio", "file", "ftp", "sftp", "jolt", "jslt", "jsonata",
    "xslt", "freemarker", "mustache", "velocity", "mock", "langchain4j", "djl",
    "aws-bedrock", "aws2-lambda", "debezium", "kubernetes", "slack", "telegram",
    "twitter", "twilio", "irc", "xmpp", "mail", "salesforce", "servicenow", "jira",
    "github", "git", "kubernetes", "micrometer", "splunk", "influxdb", "fix",
    "quickfix", "opcua", "plc4x", "mllp", "fhir", "modbus", "snmp", "iec60870",
    "paho", "kamelet", "yaml-dsl", "jsonpath", "jackson", "unmarshal", "marshal",
    "choice", "filter", "split", "aggregate", "multicast", "wire-tap", "throttle",
    "circuit-breaker", "resilience4j", "sap", "workday", "zendesk", "box", "dropbox",
    "ldap", "keycloak", "vault", "consul", "wordpress", "jt400", "atlasmap", "sjms2",
    "sjms", "pgevent", "lumberjack", "cloudwatch", "pagerduty", "prometheus",
    "websocket", "sjms2", "sjms", "aws2-eventbridge", "ibm-cos", "google-bigquery",
    "google-sheets", "google-mail", "google-calendar", "google-drive", "google-functions",
    "azure-eventhubs", "azure-keyvault", "azure-cosmosdb", "swift-mt", "xchange",
    "fop", "stax", "schematron", "json-validator", "validator", "milo", "iec60870-client",
    "splunk-hec", "aws2-cw", "pg-replication-slot", "sap-netweaver", "google-sheets-stream",
    "aws-secrets-manager",
    "sjms", "sjms2", "rest-openapi", "servlet", "jaxb", "csv", "aws2-ses", "aws2-kinesis",
    "aws2-athena", "azure-key-vault", "google-mail-stream", "google-calendar-stream",
    "twitter-search", "imap", "smtp", "cm-sms", "pubnub", "cometd", "kubernetes-pods",
    "kubernetes-deployments", "kubernetes-config-maps", "kubernetes-secrets", "hashicorp-vault",
    "openshift-builds", "exec", "ssh", "cron", "quartz", "langchain4j-chat", "langchain4j-embeddings",
    "langchain4j-tools", "langchain4j-web-search", "openai", "milvus", "pinecone", "qdrant",
    "weaviate", "tika", "docling", "saga", "file-watch", "pdf", "xj", "flatpack", "smb",
    "paho-mqtt5", "opc-ua", "plc4x", "mllp", "hl7", "fhir", "modbus", "snmp", "iec60870",
    "swift-mt", "quickfix", "xchange", "workday", "zendesk", "servicenow", "salesforce",
    "box", "dropbox", "ldap", "keycloak", "consul", "wordpress", "jt400", "atlasmap",
    "debezium-mysql", "debezium-postgres", "debezium-mongodb", "pgevent", "lumberjack",
    "cloudwatch", "pagerduty", "prometheus", "sjms2", "telegram", "twilio", "irc", "xmpp",
    "mail", "git", "github", "jira", "knative", "sjms", "aws2-eventbridge", "ibm-cos",
}

COMPONENT_ALIASES = {
    "aws-sqs": "aws2-sqs", "aws-sns": "aws2-sns", "aws-s3": "aws2-s3",
    "aws-dynamodb": "aws2-ddb", "aws-lambda": "aws2-lambda", "redis": "spring-redis",
    "elasticsearch": "elasticsearch-rest-client", "azure-keyvault": "azure-key-vault",
    "google-mail": "google-mail-stream", "google-calendar": "google-calendar-stream",
    "langchain4j": "langchain4j-chat", "vault": "hashicorp-vault", "kubernetes": "kubernetes-pods",
    "debezium": "debezium-mysql", "paho-mqtt5": "paho-mqtt5", "mqtt": "paho-mqtt5",
    "opc-ua": "milo", "opcua": "milo", "iec60870": "iec60870-client",
    "google-sheets": "google-sheets-stream", "cloudwatch": "aws2-cw", "splunk": "splunk-hec",
    "sap": "sap-netweaver", "json-schema-validate": "json-validator",
    "coap": "coap", "websocket": "vertx-websocket", "sjms2": "sjms2",
}


def load_known_components() -> set[str]:
    try:
        with urllib.request.urlopen(KNOWN_EXTENSIONS_URL, timeout=15) as resp:
            data = resp.read().decode()
        components = set()
        for line in data.splitlines():
            if line.strip().startswith("- name:"):
                name = line.split(":", 1)[1].strip().strip('"')
                components.add(name.replace("camel-quarkus-", ""))
        if components:
            return components
    except Exception as e:
        print(f"WARN: could not fetch camel-quarkus catalog: {e}")
    return FALLBACK_COMPONENTS


def extract_catalog_components(html: str) -> list[tuple[str, str, set[str]]]:
    examples = []
    pattern = re.compile(
        r'\{\s*num:\s*"(\d+)"\s*,\s*name:\s*"([^"]+)"\s*,\s*comp:\s*"([^"]+)"',
        re.MULTILINE,
    )
    for m in pattern.finditer(html):
        num, name, comp_field = m.group(1), m.group(2), m.group(3)
        comps = {c.strip() for c in comp_field.split(",") if c.strip()}
        examples.append((num, name, comps))
    return examples


def main() -> int:
    if not CATALOG_HTML.exists():
        print(f"ERROR: catalog not found at {CATALOG_HTML}")
        return 1

    html = CATALOG_HTML.read_text(encoding="utf-8")
    examples = extract_catalog_components(html)
    known = load_known_components()

    invalid: list[str] = []
    for num, name, comps in examples:
        for comp in comps:
            normalized = COMPONENT_ALIASES.get(comp, comp)
            for old, new in COMPONENT_ALIASES.items():
                if comp == old:
                    normalized = new
                    break
            if normalized not in known and comp not in known:
                invalid.append(f"  [{num}] {name}: unknown component '{comp}'")

    print(f"Validated {len(examples)} catalog examples against {len(known)} known extensions")
    if invalid:
        print(f"FAIL: {len(invalid)} unknown component references:")
        for line in invalid[:50]:
            print(line)
        if len(invalid) > 50:
            print(f"  ... and {len(invalid) - 50} more")
        return 1

    print("PASS: all catalog components are recognized")
    return 0


if __name__ == "__main__":
    sys.exit(main())
