#!/bin/bash
set -euo pipefail

CERT_FILE="${QUARKUS_HTTP_SSL_CERTIFICATE_FILES:-/etc/tls/tls.crt}"

if [ -n "${QUARKUS_HTTP_SSL_CERTIFICATE_FILES:-}" ]; then
  for _ in $(seq 1 30); do
    if [ -f "$CERT_FILE" ]; then
      break
    fi
    sleep 2
  done
  if [ ! -f "$CERT_FILE" ]; then
    echo "TLS certificate not found at ${CERT_FILE}; starting operator on HTTP only"
    unset QUARKUS_HTTP_SSL_PORT
    unset QUARKUS_HTTP_SSL_CERTIFICATE_FILES
    unset QUARKUS_HTTP_SSL_CERTIFICATE_KEY_FILES
  fi
fi

exec /opt/jboss/container/java/run/run-java.sh
