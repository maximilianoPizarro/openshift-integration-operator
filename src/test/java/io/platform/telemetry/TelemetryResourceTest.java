package io.platform.telemetry;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
public class TelemetryResourceTest {

    @Test
    void testSnapshotEndpoint() {
        given()
            .when().get("/api/telemetry/snapshot/test-flow")
            .then()
            .statusCode(200)
            .body("schemaVersion", equalTo("1.0"))
            .body("flowId", equalTo("test-flow"))
            .body("nodes", notNullValue())
            .body("nodes.size()", greaterThan(0));
    }
}
