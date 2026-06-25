import useSWR from "swr";
import { authAdminEmailClient, unwrapEdenResponse } from "@/lib/api-client";

export type AuthEmailTemplate = {
  name: string;
  description: string;
  propSchema: Record<
    string,
    { type: string; required: boolean; description: string }
  >;
};

export type AuthEmailPreviewInput = {
  template: string;
  props: Record<string, unknown>;
};

export type AuthEmailSendTestInput = AuthEmailPreviewInput & {
  to: string;
};

export type AuthEmailPreviewResponse = {
  html: string;
};

export type AuthEmailSendTestResponse = {
  success: boolean;
  to: string;
};

export type AuthEmailSmtpTestResponse = {
  connected: boolean;
  host?: string;
  port?: string;
  error?: string;
};

type AuthEmailErrorResponse = {
  error: string;
};

function isAuthEmailErrorResponse(
  value: unknown,
): value is AuthEmailErrorResponse {
  return (
    value !== null &&
    typeof value === "object" &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "string"
  );
}

function unwrapAuthEmailData<T>(
  value: T | AuthEmailErrorResponse,
  fallbackMessage: string,
): T {
  if (isAuthEmailErrorResponse(value)) {
    throw new Error(value.error || fallbackMessage);
  }
  return value;
}

const AUTH_EMAIL_TEMPLATES_KEY = [
  "eden",
  "auth",
  "admin-email",
  "templates",
] as const;

async function fetchAuthEmailTemplates(): Promise<AuthEmailTemplate[]> {
  const response = await authAdminEmailClient.admin.email.templates.get();
  return unwrapAuthEmailData<AuthEmailTemplate[]>(
    unwrapEdenResponse(response),
    "Failed to load email templates",
  );
}

export function useAuthEmailTemplatesQuery() {
  const query = useSWR<AuthEmailTemplate[]>(
    AUTH_EMAIL_TEMPLATES_KEY,
    fetchAuthEmailTemplates,
    {
      dedupingInterval: 60_000,
      keepPreviousData: true,
    },
  );

  return {
    data: query.data,
    error: query.error,
    isError: Boolean(query.error),
    isFetching: query.isValidating,
    isLoading: query.isLoading,
    refetch: () => query.mutate(),
  };
}

async function fetchAuthEmailPreview(
  input: AuthEmailPreviewInput,
): Promise<AuthEmailPreviewResponse> {
  const response = await authAdminEmailClient.admin.email.preview.post(input);
  return unwrapAuthEmailData<AuthEmailPreviewResponse>(
    unwrapEdenResponse(response),
    "Failed to render email preview",
  );
}

export function useAuthEmailPreviewQuery(
  input: AuthEmailPreviewInput | null,
) {
  const query = useSWR(
    input
      ? ["eden", "auth", "admin-email", "preview", input.template, input.props]
      : null,
    () => fetchAuthEmailPreview(input!),
    {
      keepPreviousData: true,
    },
  );

  return {
    data: query.data,
    error: query.error,
    isError: Boolean(query.error),
    isFetching: query.isValidating,
    isLoading: query.isLoading,
    refetch: () => query.mutate(),
  };
}

export async function sendAuthEmailTest(
  input: AuthEmailSendTestInput,
): Promise<AuthEmailSendTestResponse> {
  const response = await authAdminEmailClient.admin.email["send-test"].post(
    input,
  );
  return unwrapAuthEmailData<AuthEmailSendTestResponse>(
    unwrapEdenResponse(response),
    "Failed to send test email",
  );
}

export async function testAuthEmailSmtp(): Promise<AuthEmailSmtpTestResponse> {
  const response = await authAdminEmailClient.admin.email["smtp-test"].post();
  return unwrapAuthEmailData<AuthEmailSmtpTestResponse>(
    unwrapEdenResponse(response),
    "Failed to test SMTP connection",
  );
}
