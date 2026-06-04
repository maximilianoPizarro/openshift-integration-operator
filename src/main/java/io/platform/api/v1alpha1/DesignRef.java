package io.platform.api.v1alpha1;

public class DesignRef {

    public enum Kind {
        ConfigMap,
        GitPath
    }

    private Kind kind;
    private String name;
    private String namespace;
    /** Path within git repo when kind is GitPath */
    private String path;

    public Kind getKind() {
        return kind;
    }

    public void setKind(Kind kind) {
        this.kind = kind;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getNamespace() {
        return namespace;
    }

    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }
}
