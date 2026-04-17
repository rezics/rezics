import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { authApi } from "@rezics/api/auth/auth.api";
import { render, templateRegistry } from "@rezics/email";
import { useEffect, useMemo, useState } from "react";

type TemplateInfo = (typeof templateRegistry)[number];

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
    <Box sx={{ p: 3, maxWidth: 1200 }}>
      <Typography variant="h5" gutterBottom>
        Email Templates
      </Typography>

      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {/* Left panel: controls */}
        <Box sx={{ flex: "1 1 400px", minWidth: 360 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Template</InputLabel>
            <Select
              value={selectedTemplate}
              label="Template"
              onChange={(e) => setSelectedTemplate(e.target.value)}
            >
              {templateRegistry.map((t) => (
                <MenuItem key={t.name} value={t.name}>
                  {t.name} — {t.description}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {currentTemplate &&
            Object.entries(currentTemplate.propSchema).map(([key, schema]) => (
              <TextField
                key={key}
                label={`${key}${schema.required ? " *" : ""}`}
                helperText={schema.description}
                value={formValues[key] ?? ""}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, [key]: e.target.value }))
                }
                fullWidth
                sx={{ mb: 2 }}
              />
            ))}

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
            Send Test Email
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <TextField
              label="Recipient email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              onClick={handleSendTest}
              disabled={loading || !recipientEmail}
            >
              {loading ? <CircularProgress size={20} /> : "Send Test"}
            </Button>
          </Box>
          {sendResult && (
            <Alert severity={sendResult.type} sx={{ mt: 1 }}>
              {sendResult.message}
            </Alert>
          )}

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
            SMTP Diagnostics
          </Typography>
          <Button
            variant="outlined"
            onClick={handleSmtpTest}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : "Test Connection"}
          </Button>
          {smtpResult && (
            <Alert severity={smtpResult.type} sx={{ mt: 1 }}>
              {smtpResult.message}
            </Alert>
          )}
        </Box>

        {/* Right panel: preview */}
        <Box
          sx={{
            flex: "1 1 500px",
            minWidth: 400,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            overflow: "hidden",
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{ p: 1, bgcolor: "grey.100", borderBottom: "1px solid", borderColor: "divider" }}
          >
            Preview
          </Typography>
          {previewHtml ? (
            <iframe
              srcDoc={previewHtml}
              title="Email Preview"
              style={{
                width: "100%",
                height: 600,
                border: "none",
              }}
            />
          ) : (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography color="text.secondary">
                Select a template to preview
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function getDefaultValue(
  key: string,
  _schema: { type: string },
): string {
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
