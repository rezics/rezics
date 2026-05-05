import { type UnitDTO, unitQueries } from "@rezics/api/unit/unit";
import { unitMutations } from "@rezics/api/unit/unit.mutations";

import { Spinner } from "@rezics/ui";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Separator,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import { Page } from "@/core/layouts/Page";
import { Route } from "@/routes/_admin/unit/$unitId";
import { ArrowLeft as ArrowBackIcon, Save as SaveIcon } from "lucide-react";

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
          <div className="flex flex-row items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              render={(props) => (
                <Link to="/unit" {...props}>
                  <ArrowBackIcon className="size-4" />
                  Back
                </Link>
              )}
            />
            <div className="flex-1" />
          </div>

          <Separator className="my-4" />

          {detailQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : detailQuery.isError ? (
            <div>
              <Alert>
                <AlertDescription className="text-error-text">
                  Failed to load unit.
                </AlertDescription>
              </Alert>
              {detailQuery.error ? (
                <p className="text-xs text-error-text mt-2">
                  {String(detailQuery.error)}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              {error ? (
                <Alert className="mb-4">
                  <AlertDescription className="text-error-text">
                    {error}
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-col gap-1 mb-4">
                <p className="text-sm text-text-secondary">
                  ID: <strong>{detailQuery.data?.id ?? "-"}</strong>
                </p>
                <p className="text-sm text-text-secondary">
                  User ID: <strong>{detailQuery.data?.userId ?? "-"}</strong>
                </p>
                <p className="text-sm text-text-secondary">
                  Type: <strong>{detailQuery.data?.type ?? "-"}</strong>
                </p>
                <p className="text-sm text-text-secondary">
                  Default Language:{" "}
                  <strong>{detailQuery.data?.defaultLanguage ?? "-"}</strong>
                </p>
                <p className="text-sm text-text-secondary">
                  Created:{" "}
                  <strong>{fmtDate(detailQuery.data?.createdAt)}</strong>
                </p>
                <p className="text-sm text-text-secondary">
                  Updated:{" "}
                  <strong>{fmtDate(detailQuery.data?.updatedAt)}</strong>
                </p>
              </div>

              {/* Translations (read-only display) */}
              {detailQuery.data?.translations?.length ? (
                <div className="flex flex-col gap-2 mb-6">
                  <p className="text-xs font-semibold text-text-secondary">
                    Translations
                  </p>
                  {detailQuery.data.translations.map((tr) => (
                    <div
                      key={`${tr.unitId}-${tr.language}`}
                      className="pl-4 border-l-2 border-border-whisper"
                    >
                      <p className="text-sm font-semibold">
                        [{tr.language}] {tr.title || "(no title)"}
                      </p>
                      {tr.subtitle ? (
                        <p className="text-xs text-text-secondary">
                          Subtitle: {tr.subtitle}
                        </p>
                      ) : null}
                      {tr.summary ? (
                        <p className="text-sm text-text-secondary mt-1">
                          {tr.summary}
                        </p>
                      ) : null}
                    </div>
                  ))}
                  <p className="text-xs text-text-secondary">
                    Translations are managed via the translation API endpoints.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-secondary mb-4">
                  No translations available.
                </p>
              )}

              <Separator className="mb-4" />

              <form onSubmit={onSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-status">Status</Label>
                    <Input
                      id="uep-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      placeholder="DRAFT / PUBLISHED / ARCHIVED / ..."
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-visibility">Visibility</Label>
                    <Input
                      id="uep-visibility"
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value)}
                      placeholder="PUBLIC / UNLISTED / PRIVATE"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-extra">Extra (JSON)</Label>
                    <textarea
                      id="uep-extra"
                      value={extraText}
                      onChange={(e) => setExtraText(e.target.value)}
                      rows={6}
                      placeholder='{"key":"value"}'
                      className="font-mono rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fill"
                    />
                  </div>

                  <div>
                    <Button type="submit" disabled={updateMutation.isPending}>
                      <SaveIcon className="size-4" />
                      {updateMutation.isPending ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
