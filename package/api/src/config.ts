export interface ApiConfig {
  apiBaseUrl: string;
  authBaseUrl: string;
  authAdminBaseUrl?: string;
  historyBaseUrl?: string;
  reactionServiceUrl: string;
  notifyBaseUrl?: string;
  appVersion?: string;
}

let config: ApiConfig = {
  apiBaseUrl: "",
  authBaseUrl: "",
  reactionServiceUrl: "",
  notifyBaseUrl: "",
  appVersion: undefined,
};

/**
 * Initialise `@rezics/api` with externally-provided configuration.
 * Must be called once before any API function is used.
 */
export function configureApi(overrides: ApiConfig) {
  config = { ...overrides };
}

export function getApiConfig(): Readonly<ApiConfig> {
  return config;
}
