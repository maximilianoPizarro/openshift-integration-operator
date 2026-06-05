package io.platform.api.v1alpha1;

/**
 * Reference to a Kubernetes Secret that should be mounted into the IntegrationFlow worker.
 * Supports two modes:
 * <ul>
 *   <li><b>File mount</b>: mounts the secret as files at {@code mountPath} (e.g. properties files)</li>
 *   <li><b>Environment injection</b>: when {@code envFrom} is true, injects all secret keys as env vars</li>
 * </ul>
 */
public class SecretRef {
    private String name;
    private String mountPath;
    private boolean envFrom;
    private String subPath;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getMountPath() { return mountPath; }
    public void setMountPath(String mountPath) { this.mountPath = mountPath; }

    public boolean isEnvFrom() { return envFrom; }
    public void setEnvFrom(boolean envFrom) { this.envFrom = envFrom; }

    public String getSubPath() { return subPath; }
    public void setSubPath(String subPath) { this.subPath = subPath; }
}
