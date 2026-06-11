package io.platform.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SuppressWarnings("unchecked")
class ArgoClusterGeneratorBuilderTest {

    @Test
    void explicitClustersUseNameMatchExpressions() {
        Map<String, Object> gen = ArgoClusterGeneratorBuilder.buildClusterGenerator(
                Map.of(), List.of("local"), List.of());

        Map<String, Object> clusters = (Map<String, Object>) gen.get("clusters");
        Map<String, Object> selector = (Map<String, Object>) clusters.get("selector");
        List<Map<String, Object>> expressions = (List<Map<String, Object>>) selector.get("matchExpressions");

        assertEquals(1, expressions.size());
        assertEquals("name", expressions.get(0).get("key"));
        assertEquals("In", expressions.get(0).get("operator"));
        assertEquals(List.of("local"), expressions.get(0).get("values"));
    }

    @Test
    void excludeClustersAddNotInExpression() {
        Map<String, Object> gen = ArgoClusterGeneratorBuilder.buildClusterGenerator(
                Map.of(), List.of(), List.of("staging"));

        Map<String, Object> clusters = (Map<String, Object>) gen.get("clusters");
        Map<String, Object> selector = (Map<String, Object>) clusters.get("selector");
        List<Map<String, Object>> expressions = (List<Map<String, Object>>) selector.get("matchExpressions");

        assertEquals(1, expressions.size());
        assertEquals("NotIn", expressions.get(0).get("operator"));
        assertEquals(List.of("staging"), expressions.get(0).get("values"));
    }

    @Test
    void clusterSelectorTakesPrecedenceOverExplicitClusters() {
        Map<String, Object> gen = ArgoClusterGeneratorBuilder.buildClusterGenerator(
                Map.of("env", "dev"), List.of("local"), List.of());

        Map<String, Object> clusters = (Map<String, Object>) gen.get("clusters");
        Map<String, Object> selector = (Map<String, Object>) clusters.get("selector");

        assertEquals(Map.of("env", "dev"), selector.get("matchLabels"));
        assertNull(selector.get("matchExpressions"));
    }

    @Test
    void emptyTargetingMatchesAllClusters() {
        Map<String, Object> gen = ArgoClusterGeneratorBuilder.buildClusterGenerator(
                Map.of(), List.of(), List.of());

        assertTrue(((Map<?, ?>) gen.get("clusters")).isEmpty());
    }
}
