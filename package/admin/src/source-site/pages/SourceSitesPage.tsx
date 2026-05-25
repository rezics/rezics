import {
  sourceSiteKeys,
  useCreateSourceSite,
  useDeleteSourceSite,
  useSourceSite,
  useSourceSiteList,
  useUpdateSourceSite,
} from "@rezics/api/source-site";
import {
  unitExternalRefApi,
  useCreateUnitExternalRef,
} from "@rezics/api/unit-external-ref";
import {
  type ExternalKind,
  externalKindRegistry,
  externalKinds,
  isValidSourceRefRules,
  type SourceSiteDTO,
  type SourceSiteRefRule,
  suggestExternalKinds,
} from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Input,
  Label,
  Separator,
} from "@rezics/ui/shadcn";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Search, Trash2 } from "lucide-react";
import * as React from "react";
import { Page } from "@/core/layouts/Page";
import { Link } from "@/shared/ui/link";

const EMPTY_RULE: SourceSiteRefRule = {
  externalKind: "book",
  externalIdName: "bookId",
  urlTemplate: "https://example.com/{externalId}",
  urlMatchPattern: "^https://example\\.com/(?<externalId>[^/?#]+)",
  crawlerActionKey: null,
  crawlSupported: false,
};

function getTitle(sourceSite?: SourceSiteDTO | null) {
  const translations = sourceSite?.entity?.translations;
  return (
    translations?.[0]?.title || sourceSite?.entity?.slug || sourceSite?.key
  );
}

function RuleEditor({
  rules,
  onChange,
}: {
  rules: SourceSiteRefRule[];
  onChange: (rules: SourceSiteRefRule[]) => void;
}) {
  function updateRule(index: number, patch: Partial<SourceSiteRefRule>) {
    onChange(
      rules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...patch } : rule,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rules.map((rule, index) => (
        <div
          key={`${rule.externalKind}-${index}`}
          className="grid gap-3 rounded-md border border-border-whisper p-3 md:grid-cols-12"
        >
          <div className="md:col-span-2">
            <Label className="text-xs">Kind</Label>
            <select
              value={rule.externalKind}
              onChange={(event) =>
                updateRule(index, {
                  externalKind: event.target.value as ExternalKind,
                })
              }
              className="mt-1 h-9 w-full rounded-md border border-border-whisper bg-transparent px-2 text-sm"
            >
              {externalKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {externalKindRegistry[kind].label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">ID name</Label>
            <Input
              value={rule.externalIdName}
              onChange={(event) =>
                updateRule(index, { externalIdName: event.target.value })
              }
              className="mt-1"
            />
          </div>
          <div className="md:col-span-4">
            <Label className="text-xs">URL template</Label>
            <Input
              value={rule.urlTemplate}
              onChange={(event) =>
                updateRule(index, { urlTemplate: event.target.value })
              }
              className="mt-1 font-mono"
            />
          </div>
          <div className="md:col-span-4">
            <Label className="text-xs">Match pattern</Label>
            <Input
              value={rule.urlMatchPattern}
              onChange={(event) =>
                updateRule(index, { urlMatchPattern: event.target.value })
              }
              className="mt-1 font-mono"
            />
          </div>
          <div className="md:col-span-4">
            <Label className="text-xs">Crawler action</Label>
            <Input
              value={rule.crawlerActionKey ?? ""}
              onChange={(event) =>
                updateRule(index, {
                  crawlerActionKey: event.target.value || null,
                })
              }
              className="mt-1"
            />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-3 md:self-end">
            <Checkbox
              checked={Boolean(rule.crawlSupported)}
              onCheckedChange={(value) =>
                updateRule(index, { crawlSupported: value === true })
              }
            />
            Crawl supported
          </label>
          <div className="md:col-span-5 md:self-end md:text-right">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove rule"
              onClick={() =>
                onChange(rules.filter((_, ruleIndex) => ruleIndex !== index))
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rules, { ...EMPTY_RULE }])}
      >
        <Plus className="size-4" />
        Add rule
      </Button>
    </div>
  );
}

export function SourceSiteForm({ sourceSite }: { sourceSite?: SourceSiteDTO }) {
  const isEdit = Boolean(sourceSite);
  const createMutation = useCreateSourceSite();
  const updateMutation = useUpdateSourceSite();
  const [entityUnitId, setEntityUnitId] = React.useState(
    sourceSite?.entityUnitId ?? "",
  );
  const [key, setKey] = React.useState(sourceSite?.key ?? "");
  const [crawlSupport, setCrawlSupport] = React.useState(
    sourceSite?.crawlSupport ?? "none",
  );
  const [crawlEnabled, setCrawlEnabled] = React.useState(
    sourceSite?.crawlEnabled ?? false,
  );
  const [crawlerAdapterKey, setCrawlerAdapterKey] = React.useState(
    sourceSite?.crawlerAdapterKey ?? "",
  );
  const [rules, setRules] = React.useState<SourceSiteRefRule[]>(
    sourceSite?.refRules?.length ? sourceSite.refRules : [{ ...EMPTY_RULE }],
  );
  const [error, setError] = React.useState<string | null>(null);

  const supportsCrawl =
    crawlSupport === "supported" && crawlerAdapterKey.trim().length > 0;
  const canScheduleCrawl = supportsCrawl && crawlEnabled;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isValidSourceRefRules(rules)) {
      setError(
        "Reference rules must include unique kinds, {externalId}, and a matching capture.",
      );
      return;
    }

    const payload = {
      key: key.trim(),
      crawlSupport,
      crawlEnabled,
      crawlerAdapterKey: crawlerAdapterKey.trim() || null,
      refRules: rules,
    };

    if (isEdit && sourceSite) {
      await updateMutation.mutateAsync({
        entityUnitId: sourceSite.entityUnitId,
        input: payload,
      });
    } else {
      await createMutation.mutateAsync({
        entityUnitId: entityUnitId.trim(),
        ...payload,
      });
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="source-site-entity">Entity Unit ID</Label>
          <Input
            id="source-site-entity"
            value={entityUnitId}
            disabled={isEdit}
            onChange={(event) => setEntityUnitId(event.target.value)}
            className="mt-1 font-mono"
          />
        </div>
        <div>
          <Label htmlFor="source-site-key">Internal key</Label>
          <Input
            id="source-site-key"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="source-site-crawl-support">Crawl support</Label>
          <select
            id="source-site-crawl-support"
            value={crawlSupport}
            onChange={(event) => setCrawlSupport(event.target.value as any)}
            className="mt-1 h-9 w-full rounded-md border border-border-whisper bg-transparent px-2 text-sm"
          >
            <option value="none">None</option>
            <option value="planned">Planned</option>
            <option value="supported">Supported</option>
            <option value="deprecated">Deprecated</option>
          </select>
        </div>
        <div>
          <Label htmlFor="source-site-adapter">Crawler adapter key</Label>
          <Input
            id="source-site-adapter"
            value={crawlerAdapterKey}
            onChange={(event) => setCrawlerAdapterKey(event.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={crawlEnabled}
          onCheckedChange={(value) => setCrawlEnabled(value === true)}
        />
        Crawl enabled
      </label>

      <div className="rounded-md bg-surface-subtle p-3 text-sm leading-normal text-text-secondary">
        <span className="font-medium text-text-primary">Scheduling:</span>{" "}
        supports crawl {supportsCrawl ? "yes" : "no"} · can schedule{" "}
        {canScheduleCrawl ? "yes" : "no"}
      </div>

      <RuleEditor rules={rules} onChange={setRules} />

      {error ? <p className="text-sm text-error-text">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        <Save className="size-4" />
        {isEdit ? "Save source site" : "Create source site"}
      </Button>
    </form>
  );
}

function ExternalRefControl({ sourceSite }: { sourceSite: SourceSiteDTO }) {
  const createRef = useCreateUnitExternalRef();
  const queryClient = useQueryClient();
  const availableKinds = sourceSite.refRules.map((rule) => rule.externalKind);
  const sortedKinds = suggestExternalKinds("BOOK", availableKinds);
  const [unitId, setUnitId] = React.useState("");
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [externalKind, setExternalKind] = React.useState<ExternalKind>(
    sortedKinds[0] ?? "book",
  );
  const [externalId, setExternalId] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);

  async function parseUrl() {
    setMessage(null);
    const parsed = await unitExternalRefApi.parseUrl({
      sourceSiteEntityUnitId: sourceSite.entityUnitId,
      url: sourceUrl,
    });
    setExternalKind(parsed.externalKind);
    setExternalId(parsed.externalId);
  }

  async function create() {
    setMessage(null);
    await createRef.mutateAsync({
      unitId: unitId.trim(),
      sourceSiteEntityUnitId: sourceSite.entityUnitId,
      externalKind,
      externalId: externalId.trim(),
      originalUrl: sourceUrl.trim() || null,
    });
    await queryClient.invalidateQueries({
      queryKey: sourceSiteKeys.detail(sourceSite.entityUnitId),
    });
    setMessage("External reference created.");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="external-ref-unit">Target Unit ID</Label>
          <Input
            id="external-ref-unit"
            value={unitId}
            onChange={(event) => setUnitId(event.target.value)}
            className="mt-1 font-mono"
          />
        </div>
        <div>
          <Label htmlFor="external-ref-url">Source URL</Label>
          <div className="mt-1 flex gap-2">
            <Input
              id="external-ref-url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Parse URL"
              onClick={parseUrl}
            >
              <Search className="size-4" />
            </Button>
          </div>
        </div>
        <div>
          <Label htmlFor="external-ref-kind">External kind</Label>
          <select
            id="external-ref-kind"
            value={externalKind}
            onChange={(event) =>
              setExternalKind(event.target.value as ExternalKind)
            }
            className="mt-1 h-9 w-full rounded-md border border-border-whisper bg-transparent px-2 text-sm"
          >
            {sortedKinds.map((kind) => (
              <option key={kind} value={kind}>
                {externalKindRegistry[kind].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="external-ref-id">External ID</Label>
          <Input
            id="external-ref-id"
            value={externalId}
            onChange={(event) => setExternalId(event.target.value)}
            className="mt-1 font-mono"
          />
        </div>
      </div>
      <Button
        type="button"
        onClick={create}
        disabled={createRef.isPending || !unitId || !externalId}
      >
        <Plus className="size-4" />
        Create external ref
      </Button>
      {message ? <p className="text-sm text-success-text">{message}</p> : null}
      {createRef.isError ? (
        <p className="text-sm text-error-text">{createRef.error.message}</p>
      ) : null}
    </div>
  );
}

export function SourceSiteDetail({ entityUnitId }: { entityUnitId: string }) {
  const sourceSiteQuery = useSourceSite(entityUnitId);
  const deleteMutation = useDeleteSourceSite();

  if (sourceSiteQuery.isLoading) {
    return (
      <Page title="Source site">
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      </Page>
    );
  }

  if (!sourceSiteQuery.data) {
    return (
      <Page title="Source site">
        <p className="text-sm text-error-text">Source site not found.</p>
      </Page>
    );
  }

  const sourceSite = sourceSiteQuery.data;

  return (
    <Page
      title={getTitle(sourceSite) ?? sourceSite.key}
      description={`Internal key: ${sourceSite.key}`}
      actions={
        <Button
          type="button"
          variant="outline"
          onClick={() => deleteMutation.mutate(sourceSite.entityUnitId)}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
              <span>Entity slug: {sourceSite.entity?.slug ?? "-"}</span>
              {sourceSite.entityUnitId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  render={(props) => (
                    <Link
                      to="/entity/$unitId"
                      params={{ unitId: sourceSite.entityUnitId }}
                      {...props}
                    >
                      View Entity
                    </Link>
                  )}
                />
              ) : null}
            </div>
            <SourceSiteForm sourceSite={sourceSite} />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-3 text-base font-medium">Unit external ref</h2>
            <ExternalRefControl sourceSite={sourceSite} />
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}

export default function SourceSitesPage() {
  const [q, setQ] = React.useState("");
  const [query, setQuery] = React.useState("");
  const sourceSites = useSourceSiteList({ q: query || undefined, limit: 50 });
  const rows = sourceSites.data?.sourceSites ?? [];

  return (
    <Page
      title="Source sites"
      description="Entity-bound source configuration and reference rules."
    >
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent>
            <div className="flex gap-2">
              <Input
                aria-label="Search source sites"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") setQuery(q.trim());
                }}
                placeholder="Search key or Entity title"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Search"
                onClick={() => setQuery(q.trim())}
              >
                <Search className="size-4" />
              </Button>
            </div>
            <Separator className="my-4" />
            {sourceSites.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : (
              <div className="divide-y divide-border-whisper">
                {rows.map((sourceSite) => (
                  <div
                    key={sourceSite.entityUnitId}
                    className="grid gap-2 py-3 md:grid-cols-[1fr_auto]"
                  >
                    <div className="min-w-0">
                      <div className="font-medium leading-normal">
                        {getTitle(sourceSite)}
                      </div>
                      <div className="mt-1 text-xs font-mono text-text-secondary">
                        {sourceSite.key} · {sourceSite.entityUnitId}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      render={(props) => (
                        <Link
                          to="/source-site/$entityUnitId"
                          params={{ entityUnitId: sourceSite.entityUnitId }}
                          {...props}
                        >
                          Edit
                        </Link>
                      )}
                    />
                  </div>
                ))}
                {!rows.length ? (
                  <p className="py-6 text-sm text-text-secondary">
                    No source sites found.
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-3 text-base font-medium">Create source site</h2>
            <SourceSiteForm />
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
