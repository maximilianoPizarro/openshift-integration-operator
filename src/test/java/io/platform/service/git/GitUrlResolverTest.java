package io.platform.service.git;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.*;

class GitUrlResolverTest {

    private GitUrlResolver resolver;

    @BeforeEach
    void setUp() throws Exception {
        resolver = new GitUrlResolver();
        setField("giteaUrl", "https://gitea-gitea.apps.demo.example.com");
        setField("githubUrl", "https://github.com");
        setField("gitlabUrl", "https://gitlab.com");
    }

    @Test
    void rewritesGiteaPlaceholderHost() {
        String resolved = resolver.resolve("https://gitea.example.com/user1/my-flow");
        assertEquals("https://gitea-gitea.apps.demo.example.com/user1/my-flow", resolved);
    }

    @Test
    void leavesRealHostUnchanged() {
        String url = "https://gitea-gitea.apps.demo.example.com/user1/my-flow";
        assertEquals(url, resolver.resolve(url));
    }

    private void setField(String name, String value) throws Exception {
        Field f = GitUrlResolver.class.getDeclaredField(name);
        f.setAccessible(true);
        f.set(resolver, value);
    }
}
