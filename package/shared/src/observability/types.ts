export type ObservabilityOutputMode = "local" | "json";

export type ObservabilityLevel = "info" | "warn" | "error";

export type ServiceKey =
  | "server"
  | "auth"
  | "reaction"
  | "history"
  | "notify"
  | "job-runner"
  | "preview";

export interface ServiceMetadata {
  key: ServiceKey;
  displayName: string;
  environment: string;
  port: number;
  hostname?: string;
  serviceUrl?: string;
  openApiPath?: string;
  healthPath?: string;
  readyPath?: string;
  slowRequestThresholdMs?: number;
}

export interface ObservabilityRuntimeConfig {
  outputMode: ObservabilityOutputMode;
  color: boolean;
  slowRequestThresholdMs: number;
}

export interface ObservabilityConfig {
  service: ServiceMetadata;
  runtime: ObservabilityRuntimeConfig;
}

export interface ObservabilityEnvInput {
  nodeEnv?: string;
  logFormat?: string;
  color?: string;
  slowRequestThresholdMs?: string;
  otlpEndpoint?: string;
  telemetryMode?: string;
}

export interface TelemetryConfig {
  serviceName: string;
  environment: string;
  enabled: boolean;
  required: boolean;
  otlpEndpoint?: string;
}

export interface TelemetryRuntime {
  enabled: boolean;
  shutdown?: () => Promise<void>;
}

export interface RequestTimingEvent {
  timestamp: string;
  level: ObservabilityLevel;
  service: string;
  serviceKey: string;
  environment: string;
  message: string;
  method: string;
  route?: string;
  path: string;
  status: number;
  durationMs: number;
  slow: boolean;
  requestId?: string;
  traceId?: string;
  spanId?: string;
}

export interface ErrorLogEvent {
  timestamp: string;
  level: "error";
  service: string;
  serviceKey: string;
  environment: string;
  message: string;
  method?: string;
  route?: string;
  path?: string;
  status?: number;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  error: {
    name: string;
    message: string;
    code?: string;
  };
}
