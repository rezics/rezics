import type {
  AuthEmailErrorResponse,
  AuthEmailPreviewInput,
  AuthEmailPreviewResponse,
  AuthEmailSendTestInput,
  AuthEmailSendTestResponse,
  AuthEmailSmtpTestResponse,
  AuthEmailTemplatesResponse,
} from "@rezics/contract";
import useSWR from "swr";
import { authAdminEmailClient, unwrapEdenResponse } from "@/lib/api-client";

export type {
  AuthEmailPreviewInput,
  AuthEmailPreviewResponse,
  AuthEmailSendTestInput,
  AuthEmailSendTestResponse,
  AuthEmailSmtpTestResponse,
  AuthEmailTemplate,
} from "@rezics/contract";

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

async function fetchAuthEmailTemplates(): Promise<AuthEmailTemplatesResponse> {
  const response = await authAdminEmailClient.admin.email.templates.get();
  return unwrapAuthEmailData<AuthEmailTemplatesResponse>(
    unwrapEdenResponse(response),
    "Failed to load email templates",
  );
}

export function useAuthEmailTemplatesQuery() {
  const query = useSWR<AuthEmailTemplatesResponse>(
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
