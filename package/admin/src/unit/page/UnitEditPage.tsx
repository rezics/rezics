import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { type UnitDTO, unitQueries } from "@rezics/api/unit/unit";
import { unitMutations } from "@rezics/api/unit/unit.mutations";

import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import { Page } from "@/core/layout/Page";
import { Route } from "@/routes/_admin/units/$unitId";

function fmtDate(v?: string | Date) {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

function toJsonText(value: unknown) {
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function UnitEditPage() {
  const { unitId } = Route.useParams();
  const [error, setError] = React.useState<string | null>(null);

  const detailQuery = useQuery(unitQueries.detail(unitId));

  const updateMutation = unitMutations.useUpdate({
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Update failed"),
    onSuccess: () => setError(null),
  });

  const [status, setStatus] = React.useState("");
  const [visibility, setVisibility] = React.useState("");
  const [extraText, setExtraText] = React.useState("");

  React.useEffect(() => {
    const u: UnitDTO | undefined = detailQuery.data;
    if (!u) return;
    setStatus(u.status ?? "");
    setVisibility(u.visibility ?? "");
    setExtraText(toJsonText(u.extra));
  }, [detailQuery.data]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let extra: any;
    const trimmedExtra = extraText.trim();
    if (trimmedExtra.length > 0) {
      try {
        extra = JSON.parse(trimmedExtra);
      } catch {
        setError("Extra must be valid JSON.");
        return;
      }
    }

    await updateMutation.mutateAsync({
      unitId,
      input: {
        status: status.trim() || undefined,
        visibility: visibility.trim() || undefined,
        extra,
      } as any,
    });

    await detailQuery.refetch();
  }

  return (
    <Page title="Edit Unit" description={`编辑 Unit：${unitId}`}>
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Button
              component={Link}
              to="/units"
              startIcon={<ArrowBackIcon />}
              variant="text"
            >
              Back
            </Button>
            <Box sx={{ flex: 1 }} />
          </Stack>

          <Divider sx={{ my: 2 }} />

          {detailQuery.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress size={24} />
            </Box>
          ) : detailQuery.isError ? (
            <Box>
              <Alert severity="error">Failed to load unit.</Alert>
              {detailQuery.error ? (
                <Typography color="error" variant="caption">
                  {String(detailQuery.error)}
                </Typography>
              ) : null}
            </Box>
          ) : (
            <>
              {error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              ) : null}

              <Stack spacing={0.5} sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  ID: <strong>{detailQuery.data?.id ?? "-"}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  User ID: <strong>{detailQuery.data?.userId ?? "-"}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Type: <strong>{detailQuery.data?.type ?? "-"}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Default Language:{" "}
                  <strong>
                    {detailQuery.data?.defaultLanguage ?? "-"}
                  </strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Created:{" "}
                  <strong>{fmtDate(detailQuery.data?.createdAt)}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Updated:{" "}
                  <strong>{fmtDate(detailQuery.data?.updatedAt)}</strong>
                </Typography>
              </Stack>

              {/* Translations (read-only display) */}
              {detailQuery.data?.translations?.length ? (
                <Stack spacing={1} sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Translations
                  </Typography>
                  {detailQuery.data.translations.map((tr) => (
                    <Box
                      key={`${tr.unitId}-${tr.language}`}
                      sx={{
                        pl: 2,
                        borderLeft: 2,
                        borderColor: "divider",
                      }}
                    >
                      <Typography variant="body2" fontWeight={600}>
                        [{tr.language}] {tr.title || "(no title)"}
                      </Typography>
                      {tr.subtitle ? (
                        <Typography variant="caption" color="text.secondary">
                          Subtitle: {tr.subtitle}
                        </Typography>
                      ) : null}
                      {tr.summary ? (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.5 }}
                        >
                          {tr.summary}
                        </Typography>
                      ) : null}
                    </Box>
                  ))}
                  <Typography variant="caption" color="text.secondary">
                    Translations are managed via the translation API
                    endpoints.
                  </Typography>
                </Stack>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  No translations available.
                </Typography>
              )}

              <Divider sx={{ mb: 2 }} />

              <Box component="form" onSubmit={onSubmit}>
                <Stack spacing={2}>
                  <TextField
                    label="Status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    placeholder="DRAFT / PUBLISHED / ARCHIVED / ..."
                  />
                  <TextField
                    label="Visibility"
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    placeholder="PUBLIC / UNLISTED / PRIVATE"
                  />
                  <TextField
                    label="Extra (JSON)"
                    value={extraText}
                    onChange={(e) => setExtraText(e.target.value)}
                    multiline
                    minRows={6}
                    placeholder='{"key":"value"}'
                  />

                  <Box>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<SaveIcon />}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? "Saving…" : "Save"}
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
