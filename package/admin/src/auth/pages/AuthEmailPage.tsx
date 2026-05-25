import { authApi } from "@rezics/api/auth/auth.api";
import * as m from "@rezics/i18n/messages";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useEffect, useMemo, useState } from "react";
import { Page } from "@/core/layouts/Page";

type EmailTemplate = {
  name: string;
  description: string;
  propSchema: Record<
    string,
    { type: string; required: boolean; description: string }
  >;
};

type SendTestStats = {
  status: "success" | "error";
  template: string;
  recipient: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
};

export default function AuthEmailPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [recipientEmail, setRecipientEmail] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [sendResult, setSendResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [sendStats, setSendStats] = useState<SendTestStats | null>(null);
  const [smtpResult, setSmtpResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const currentTemplate = useMemo(
    () => templates.find((t) => t.name === selectedTemplate),
    [selectedTemplate, templates],
  );

  useEffect(() => {
    let cancelled = false;

    authApi
      .adminEmailTemplates()
      .then((items) => {
        if (cancelled) return;
        setTemplates(items);
        setSelectedTemplate((current) => current || items[0]?.name || "");
        setTemplateError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setTemplateError(
          err instanceof Error
            ? err.message
            : m.admin_auth_email_failed_load_templates(),
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentTemplate) return;
    const defaults: Record<string, string> = {};
    for (const [key, schema] of Object.entries(currentTemplate.propSchema)) {
      defaults[key] = getDefaultValue(key, schema);
    }
    setFormValues(defaults);
  }, [currentTemplate]);

  useEffect(() => {
    if (!selectedTemplate) return;
    let cancelled = false;

    authApi
      .adminEmailPreview({
        template: selectedTemplate,
        props: formValues,
      })
      .then(({ html }) => {
        if (!cancelled) {
          setPreviewHtml(html);
          setTemplateError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPreviewHtml("");
          setTemplateError(
            err instanceof Error
              ? err.message
              : m.admin_auth_email_failed_render_preview(),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTemplate, formValues]);

  const handleSendTest = async () => {
    if (!recipientEmail || !selectedTemplate) return;
    const startedAt = new Date();
    const startedAtMs = performance.now();
    setLoading(true);
    setSendResult(null);
    setSendStats(null);
    try {
      const result = await authApi.adminEmailSendTest({
        template: selectedTemplate,
        props: formValues,
        to: recipientEmail,
      });
      const completedAt = new Date();
      setSendResult({
        type: "success",
        message: m.admin_auth_email_sent_to({ email: result.to }),
      });
      setSendStats({
        status: "success",
        template: selectedTemplate,
        recipient: result.to,
        startedAt,
        completedAt,
        durationMs: performance.now() - startedAtMs,
      });
    } catch (err) {
      const completedAt = new Date();
      setSendResult({
        type: "error",
        message:
          err instanceof Error ? err.message : m.admin_auth_email_failed_send(),
      });
      setSendStats({
        status: "error",
        template: selectedTemplate,
        recipient: recipientEmail,
        startedAt,
        completedAt,
        durationMs: performance.now() - startedAtMs,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSmtpTest = async () => {
    setLoading(true);
    setSmtpResult(null);
    try {
      const result = await authApi.adminEmailSmtpTest();
      if (result.connected) {
        setSmtpResult({
          type: "success",
          message: m.admin_auth_email_connected_to({
            host: result.host ?? "",
            port: String(result.port),
          }),
        });
      } else {
        setSmtpResult({
          type: "error",
          message: result.error ?? m.admin_auth_email_connection_failed(),
        });
      }
    } catch (err) {
      setSmtpResult({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : m.admin_auth_email_connection_test_failed(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page title={m.admin_auth_email_templates_title()}>
      {templateError && (
        <Alert className="mb-4">
          <AlertDescription className="text-error-text">
            {templateError}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-6 flex-wrap">
        {/* Left panel: controls */}
        <div className="flex-1 min-w-[360px] basis-[400px]">
          <div className="flex flex-col gap-1 mb-4">
            <Label>{m.admin_auth_email_template()}</Label>
            <Select
              value={selectedTemplate}
              onValueChange={(value) => {
                if (value) setSelectedTemplate(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={m.admin_auth_email_template()} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name} — {t.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentTemplate &&
            Object.entries(currentTemplate.propSchema).map(([key, schema]) => (
              <div key={key} className="flex flex-col gap-1 mb-4">
                <Label htmlFor={`aep-${key}`}>
                  {key}
                  {schema.required ? " *" : ""}
                </Label>
                <Input
                  id={`aep-${key}`}
                  value={formValues[key] ?? ""}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      [key]: e.target.value,
                    }))
                  }
                />
                {schema.description ? (
                  <p className="text-xs text-text-secondary">
                    {schema.description}
                  </p>
                ) : null}
              </div>
            ))}

          <h3 className="text-base font-bold mt-6 mb-2">
            {m.admin_auth_email_send_test_email()}
          </h3>
          <div className="flex gap-2 items-start">
            <div className="flex-1 flex flex-col gap-1">
              <Label htmlFor="aep-recipient">
                {m.admin_auth_email_recipient_label()}
              </Label>
              <Input
                id="aep-recipient"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>
            <Button
              className="self-end"
              onClick={handleSendTest}
              disabled={loading || !recipientEmail}
            >
              {loading ? <Spinner size="sm" /> : null}
              {m.admin_auth_email_send_test()}
            </Button>
          </div>
          {sendResult && (
            <Alert className="mt-2">
              <AlertDescription
                className={
                  sendResult.type === "success"
                    ? "text-success-text"
                    : "text-error-text"
                }
              >
                {sendResult.message}
              </AlertDescription>
            </Alert>
          )}
          {sendStats && (
            <div className="mt-3 rounded-md bg-surface-subtle p-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-text-secondary">
                {m.admin_auth_email_send_timing()}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-text-secondary">
                    {m.admin_auth_email_status()}
                  </dt>
                  <dd
                    className={
                      sendStats.status === "success"
                        ? "font-medium text-success-text"
                        : "font-medium text-error-text"
                    }
                  >
                    {sendStats.status === "success"
                      ? m.admin_auth_email_status_success()
                      : m.admin_auth_email_status_error()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">
                    {m.admin_auth_email_api_duration()}
                  </dt>
                  <dd className="font-medium text-text-primary">
                    {formatDuration(sendStats.durationMs)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">
                    {m.admin_auth_email_template()}
                  </dt>
                  <dd className="break-words text-text-primary">
                    {sendStats.template}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">
                    {m.admin_auth_email_recipient()}
                  </dt>
                  <dd className="break-words text-text-primary">
                    {sendStats.recipient}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">
                    {m.admin_auth_email_started()}
                  </dt>
                  <dd className="text-text-primary">
                    {formatTimestamp(sendStats.startedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">
                    {m.admin_auth_email_completed()}
                  </dt>
                  <dd className="text-text-primary">
                    {formatTimestamp(sendStats.completedAt)}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <h3 className="text-base font-bold mt-6 mb-2">
            {m.admin_auth_email_smtp_diagnostics()}
          </h3>
          <Button variant="outline" onClick={handleSmtpTest} disabled={loading}>
            {loading ? <Spinner size="sm" /> : null}
            {m.admin_auth_email_test_connection()}
          </Button>
          {smtpResult && (
            <Alert className="mt-2">
              <AlertDescription
                className={
                  smtpResult.type === "success"
                    ? "text-success-text"
                    : "text-error-text"
                }
              >
                {smtpResult.message}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Right panel: preview */}
        <div className="flex-1 min-w-[400px] basis-[500px] rounded-md border border-border-whisper overflow-hidden">
          <p className="text-sm font-semibold p-2 bg-surface-elevated border-b border-border-whisper">
            {m.admin_auth_email_preview()}
          </p>
          {previewHtml ? (
            <iframe
              srcDoc={previewHtml}
              title={m.admin_auth_email_preview_title()}
              className="w-full h-[600px] border-none"
            />
          ) : (
            <div className="p-6 text-center">
              <p className="text-text-secondary">
                {m.admin_auth_email_select_template_to_preview()}
              </p>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

function getDefaultValue(key: string, _schema: { type: string }): string {
  const defaults: Record<string, string> = {
    code: "482901",
    userName: "Test User",
    url: "https://rezics.com/example",
    inviterName: "Alice",
    orgName: "Book Club",
    newEmail: "new@example.com",
  };
  return defaults[key] ?? "";
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)} ms`;
  }

  return `${(durationMs / 1000).toFixed(2)} s`;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}
