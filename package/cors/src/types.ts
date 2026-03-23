export type CorsPolicyName = 'credentialed' | 'public' | 'internal';

export interface CorsPolicyConfig {
  origin: readonly string[];
  credentials: boolean;
  methods: readonly string[];
  allowedHeaders: readonly string[];
  exposeHeaders: readonly string[];
}
