import type {
  AuthEmailErrorResponse,
  AuthEmailPreviewInput,
  AuthEmailPreviewResponse,
  AuthEmailSendTestInput,
  AuthEmailSendTestResponse,
  AuthEmailSmtpTestResponse,
  AuthEmailTemplatesResponse,
} from "@rezics/contract";
import {
  createEdenFetcher,
  useAdminEdenQuery,
} from "@/admin/shared/eden-swr";
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
type AuthEmailTemplatesKey = typeof AUTH_EMAIL_TEMPLATES_KEY;
type AuthEmailPreviewKey = readonly [
  "eden",
  "auth",
  "admin-email",
  "preview",
  AuthEmailPreviewInput["template"],
  AuthEmailPreviewInput["props"],
];

function authEmailPreviewKey(input: AuthEmailPreviewInput): AuthEmailPreviewKey {
  return [
    "eden",
    "auth",
    "admin-email",
    "preview",
    input.template,
    input.props,
  ] as const;
}

const fetchAuthEmailTemplatesResponse = createEdenFetcher<
  AuthEmailTemplatesResponse | AuthEmailErrorResponse,
  AuthEmailTemplatesKey
>(() => authAdminEmailClient.admin.email.templates.get());

async function fetchAuthEmailTemplates(
  key: AuthEmailTemplatesKey,
): Promise<AuthEmailTemplatesResponse> {
  return unwrapAuthEmailData<AuthEmailTemplatesResponse>(
    await fetchAuthEmailTemplatesResponse(key),
    "Failed to load email templates",
  );
}

export function useAuthEmailTemplatesQuery() {
  return useAdminEdenQuery(AUTH_EMAIL_TEMPLATES_KEY, fetchAuthEmailTemplates, {
    dedupingInterval: 60_000,
    keepPreviousData: true,
  });
}

const fetchAuthEmailPreviewResponse = createEdenFetcher<
  AuthEmailPreviewResponse | AuthEmailErrorResponse,
  AuthEmailPreviewKey
>((key) => {
  const [, , , , template, props] = key;
  return authAdminEmailClient.admin.email.preview.post({ template, props });
});

async function fetchAuthEmailPreview(
  key: AuthEmailPreviewKey,
): Promise<AuthEmailPreviewResponse> {
  return unwrapAuthEmailData<AuthEmailPreviewResponse>(
    await fetchAuthEmailPreviewResponse(key),
    "Failed to render email preview",
  );
}

export function useAuthEmailPreviewQuery(
  input: AuthEmailPreviewInput | null,
) {
  return useAdminEdenQuery(
    input ? authEmailPreviewKey(input) : null,
    fetchAuthEmailPreview,
    {
      keepPreviousData: true,
    },
  );
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
