package io.platform.lifecycle;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class FlowLifecycleResourceTest {

    @Test
    void extendEphemeralRequiresPositiveSeconds() {
        given()
            .when().post("/api/flows/any-flow/ephemeral/extend")
            .then()
            .statusCode(400)
            .body("error", containsString("seconds"));
    }

    @Test
    void extendEphemeralReturnsNotFoundForMissingFlow() {
        given()
            .when().post("/api/flows/nonexistent-flow-xyz/ephemeral/extend?seconds=1800")
            .then()
            .statusCode(404)
            .body("error", containsString("not found"));
    }

    @Test
    void promoteToGitOpsRequiresRepository() {
        given()
            .contentType("application/json")
            .body("{}")
            .when().post("/api/flows/any-flow/promote-to-gitops")
            .then()
            .statusCode(400)
            .body("error", containsString("gitRepository"));
    }

    @Test
    void promoteToGitOpsReturnsNotFoundForMissingFlow() {
        given()
            .contentType("application/json")
            .body("{\"gitRepository\":\"https://gitea.example.com/org/repo\",\"branch\":\"main\"}")
            .when().post("/api/flows/nonexistent-flow-xyz/promote-to-gitops")
            .then()
            .statusCode(404)
            .body("error", containsString("not found"));
    }
}
