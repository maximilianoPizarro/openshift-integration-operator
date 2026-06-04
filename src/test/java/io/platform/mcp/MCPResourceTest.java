package io.platform.mcp;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
public class MCPResourceTest {

    @Test
    void testListToolsRequiresAuth() {
        given()
            .when().get("/api/mcp/tools?server=http://localhost:8080")
            .then()
            .statusCode(401);
    }

    @Test
    void testCallToolRequiresAuth() {
        given()
            .contentType("application/json")
            .body("{}")
            .when().post("/api/mcp/tools/test-tool/call?server=http://localhost:8080")
            .then()
            .statusCode(401);
    }
}
