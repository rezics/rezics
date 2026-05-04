import { authApi } from "@rezics/api/auth/auth.api";
import { render, templateRegistry } from "@rezics/email";
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

export default function AuthEmailPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(
    templateRegistry[0]?.name ?? "",
  );
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [recipientEmail, setRecipientEmail] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [sendResult, setSendResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [smtpResult, setSmtpResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const currentTemplate = useMemo(
    () => templateRegistry.find((t) => t.name === selectedTemplate),
    [selectedTemplate],
  );

  useEffect(() => {
    if (!currentTemplate) return;
    const defaults: Record<string, string> = {};
    for (const [key, schema] of Object.entries(currentTemplate.propSchema)) {
      defaults[key] = getDefaultValue(key, schema);
    }
    setFormValues(defaults);
  }, [currentTemplate]);

  useEffect(() => {
    if (!currentTemplate) return;
    let cancelled = false;

    render(currentTemplate.component, formValues as any).then(({ html }) => {
      if (!cancelled) setPreviewHtml(html);
    });

    return () => {
      cancelled = true;
    };
  }, [currentTemplate, formValues]);

  const handleSendTest = async () => {
    if (!recipientEmail || !selectedTemplate) return;
    setLoading(true);
    setSendResult(null);
    try {
      const result = await authApi.adminEmailSendTest({
        template: selectedTemplate,
        props: formValues,
        to: recipientEmail,
      });
      setSendResult({
        type: "success",
        message: `Test email sent to ${result.to}`,
      });
    } catch (err) {
      setSendResult({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to send",
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
          message: `Connected to ${result.host}:${result.port}`,
        });
      } else {
        setSmtpResult({
          type: "error",
          message: result.error ?? "Connection failed",
        });
      }
    } catch (err) {
      setSmtpResult({
        type: "error",
        message: err instanceof Error ? err.message : "Connection test failed",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-[1200px]">
      <h2 className="text-xl font-bold mb-4">Email Templates</h2>

      <div className="flex gap-6 flex-wrap">
        {/* Left panel: controls */}
        <div className="flex-1 min-w-[360px] basis-[400px]">
          <div className="flex flex-col gap-1 mb-4">
            <Label>Template</Label>
            <Select
              value={selectedTemplate}
              onValueChange={setSelectedTemplate}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Template" />
              </SelectTrigger>
              <SelectContent>
                {templateRegistry.map((t) => (
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

          <h3 className="text-base font-bold mt-6 mb-2">Send Test Email</h3>
          <div className="flex gap-2 items-start">
            <div className="flex-1 flex flex-col gap-1">
              <Label htmlFor="aep-recipient">Recipient email</Label>
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
              Send Test
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

          <h3 className="text-base font-bold mt-6 mb-2">SMTP Diagnostics</h3>
          <Button
            variant="outline"
            onClick={handleSmtpTest}
            disabled={loading}
          >
            {loading ? <Spinner size="sm" /> : null}
            Test Connection
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
            Preview
          </p>
          {previewHtml ? (
            <iframe
              srcDoc={previewHtml}
              title="Email Preview"
              className="w-full h-[600px] border-none"
            />
          ) : (
            <div className="p-6 text-center">
              <p className="text-text-secondary">
                Select a template to preview
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
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
