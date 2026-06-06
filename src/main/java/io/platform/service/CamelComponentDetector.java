package io.platform.service;

import jakarta.enterprise.context.ApplicationScoped;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts Camel component scheme names from Kaoto YAML/JSON route designs.
 */
@ApplicationScoped
public class CamelComponentDetector {

    private static final Pattern URI_SCHEME = Pattern.compile(
            "(?:uri|endpoint)\\s*[:=]\\s*[\"']?([a-zA-Z][a-zA-Z0-9+._/-]*):",
            Pattern.CASE_INSENSITIVE | Pattern.MULTILINE);

    public Set<String> detectComponents(String kaotoDesign) {
        Set<String> components = new LinkedHashSet<>();
        if (kaotoDesign == null || kaotoDesign.isBlank()) {
            components.add("timer");
            components.add("log");
            return components;
        }

        Matcher matcher = URI_SCHEME.matcher(kaotoDesign);
        while (matcher.find()) {
            String scheme = matcher.group(1).toLowerCase();
            if (!scheme.isBlank() && !isInternalScheme(scheme)) {
                components.add(normalizeScheme(scheme));
            }
        }

        if (components.isEmpty()) {
            components.add("timer");
            components.add("log");
        }
        return components;
    }

    private boolean isInternalScheme(String scheme) {
        return scheme.equals("classpath") || scheme.equals("file") || scheme.equals("ref");
    }

    private String normalizeScheme(String scheme) {
        return switch (scheme) {
            case "platform-http", "rest", "netty-http", "vertx-http", "servlet" -> "platform-http";
            case "aws2-s3", "aws2-sqs", "aws2-sns", "aws2-ddb" -> scheme;
            default -> scheme;
        };
    }
}
