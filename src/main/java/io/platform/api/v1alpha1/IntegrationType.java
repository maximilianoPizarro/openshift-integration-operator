package io.platform.api.v1alpha1;

public enum IntegrationType {
    CAMEL_ROUTE,
    CAMEL_KAMELET,
    CAMEL_PIPE,
    CAMEL_TEST,
    SONATAFLOW;

    public static IntegrationType fromEngineType(EngineType engine) {
        if (engine == null) return CAMEL_ROUTE;
        switch (engine) {
            case CAMEL: return CAMEL_ROUTE;
            case SONATAFLOW: return SONATAFLOW;
            default: return CAMEL_ROUTE;
        }
    }

    public boolean isCamel() {
        return this == CAMEL_ROUTE || this == CAMEL_KAMELET || this == CAMEL_PIPE || this == CAMEL_TEST;
    }

    public EngineType toEngineType() {
        return isCamel() ? EngineType.CAMEL : EngineType.SONATAFLOW;
    }
}
