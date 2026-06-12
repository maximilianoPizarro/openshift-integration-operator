package io.platform.lifecycle;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class FlowLifecycleResourceTest {

    private static final String NS = "openshift-integration";

    @Test
    void extendEphemeralRequiresPositiveSeconds() {
        given()
            .when().post("/api/namespaces/" + NS + "/flows/any-flow/ephemeral/extend")
            .then()
            .statusCode(400)
            .body("error", containsString("seconds"));
    }

    @Test
    void extendEphemeralRequiresAuth() {
        given()
            .when().post("/api/namespaces/" + NS + "/flows/nonexistent-flow-xyz/ephemeral/extend?seconds=1800")
            .then()
            .statusCode(401);
    }

    @Test
    void getLogsRequiresAuth() {
        given()
            .when().get("/api/namespaces/" + NS + "/flows/nonexistent-flow-xyz/logs")
            .then()
            .statusCode(401);
    }

    @Test
    void getConfigReturnsPlatformSettings() {
        given()
            .when().get("/api/config")
            .then()
            .statusCode(200)
            .body("platformNamespace", notNullValue());
    }

    @Test
    void promoteToGitOpsRequiresRepository() {
        given()
            .contentType("application/json")
            .body("{}")
            .when().post("/api/namespaces/" + NS + "/flows/any-flow/promote-to-gitops")
            .then()
            .statusCode(400)
            .body("error", containsString("gitRepository"));
    }

    @Test
    void promoteToGitOpsRequiresAuth() {
        given()
            .contentType("application/json")
            .body("{\"gitRepository\":\"https://gitea.example.com/org/repo\",\"branch\":\"main\"}")
            .when().post("/api/namespaces/" + NS + "/flows/nonexistent-flow-xyz/promote-to-gitops")
            .then()
            .statusCode(401);
    }
}
