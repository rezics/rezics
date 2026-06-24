import type { TelemetryConfig, TelemetryRuntime } from "./types";

export async function initializeOpenTelemetry(
  config: TelemetryConfig,
): Promise<TelemetryRuntime> {
  if (!config.enabled || !config.otlpEndpoint) {
    return { enabled: false };
  }

  try {
    const [{ NodeSDK }, { OTLPTraceExporter }, resources, semanticConventions] =
      await Promise.all([
        import("@opentelemetry/sdk-node"),
        import("@opentelemetry/exporter-trace-otlp-http"),
        import("@opentelemetry/resources"),
        import("@opentelemetry/semantic-conventions"),
      ]);

    const resourceAttributes = {
      [semanticConventions.SEMRESATTRS_SERVICE_NAME ?? "service.name"]:
        config.serviceName,
      [semanticConventions.SEMRESATTRS_DEPLOYMENT_ENVIRONMENT ??
        "deployment.environment"]: config.environment,
    };

    const resource =
      "resourceFromAttributes" in resources
        ? resources.resourceFromAttributes(resourceAttributes)
        : new (
            resources as unknown as { Resource: new (args: unknown) => unknown }
          ).Resource(resourceAttributes);

    const sdk = new NodeSDK({
      resource: resource as never,
      traceExporter: new OTLPTraceExporter({
        url: config.otlpEndpoint,
      }),
    });

    sdk.start();

    return {
      enabled: true,
      shutdown: () => sdk.shutdown(),
    };
  } catch (error) {
    if (config.required) throw error;
    console.warn(
      "[Observability] OpenTelemetry initialization skipped:",
      error instanceof Error ? error.message : error,
    );
    return { enabled: false };
  }
}
