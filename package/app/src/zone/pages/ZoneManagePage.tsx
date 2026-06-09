import {
  useUpdateZone,
  zonePortalQueryOptions,
  zoneQueryOptions,
} from "@rezics/api";
import { useServerPermission } from "@rezics/api/hooks";
import { myRealmMembershipQuery } from "@rezics/api/realm/realm";
import {
  ZONE_CONFIG_SCHEMA,
  ZONE_CONFIG_V1_VERSION,
  type ZoneConfig,
  type ZoneTranslation,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QueryErrorDisplay } from "@/core";
import { canManageZone } from "../models/canManageZone";

export type ZoneManageTab = "profile" | "config" | "lifecycle";

type ZoneManagePageProps = {
  activeTab?: ZoneManageTab;
  onTabChange?: (tab: ZoneManageTab) => void;
} & (
  | {
      unitId: string;
      slug?: never;
    }
  | {
      unitId?: never;
      slug: string;
    }
);

type TranslationRow = {
  /** Stable editor row identity (not the language). 稳定的编辑器行标识（非语言）。 */
  rowId: string;
  language: string;
  title: string;
  description: string;
};

let nextRowId = 0;
function makeRowId(): string {
  nextRowId += 1;
  return `zone-translation-row-${nextRowId}`;
}

/**
 * Interim manage surface for the versioned config era: structured editors
 * (sections, menus, theme) land in a later batch; until then the whole
 * `config` envelope is edited as one JSON document. The client only checks
 * the envelope literals — the server validates strictly.
 * 版本化配置时代的过渡管理界面：结构化编辑器（分区、菜单、主题）在后续
 * 批次落地；在那之前整个 `config` 信封作为单个 JSON 文档编辑。客户端
 * 只检查信封字面量——服务端进行严格校验。
 */
export function ZoneManagePage({
  unitId,
  slug,
  activeTab = "profile",
  onTabChange,
}: ZoneManagePageProps) {
  const { t } = useTranslation(["zone", "common"]);
  const bySlugQuery = useQuery({
    ...zoneQueryOptions(slug ?? ""),
    enabled: !unitId && !!slug,
  });
  const byUnitQuery = useQuery({
    ...zonePortalQueryOptions(unitId ?? ""),
    enabled: !!unitId,
  });
  const zone = unitId ? byUnitQuery.data?.zone : bySlugQuery.data;
  const isLoading = unitId ? byUnitQuery.isLoading : bySlugQuery.isLoading;
  const isError = unitId ? byUnitQuery.isError : bySlugQuery.isError;
  const error = unitId ? byUnitQuery.error : bySlugQuery.error;

  const membershipQuery = useQuery({
    ...myRealmMembershipQuery(zone?.ownerRealmUnitId ?? ""),
    enabled: Boolean(zone?.ownerRealmUnitId),
  });
  const permission = useServerPermission();
  const allowed = canManageZone({
    permission,
    ownerRealmMemberRoleKey: membershipQuery.data?.roleKey,
  });
  const updateZone = useUpdateZone({
    onSuccess: () => toast.success(t("zone:manage_saved")),
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [configDraft, setConfigDraft] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  useEffect(() => {
    if (!zone) return;
    setRows(
      zone.translations.map((translation) => ({
        rowId: makeRowId(),
        language: translation.language,
        title: translation.title ?? "",
        description: translation.description ?? "",
      })),
    );
    setConfigDraft(JSON.stringify(zone.config, null, 2));
    setStartsAt(zone.startsAt ?? "");
    setEndsAt(zone.endsAt ?? "");
  }, [zone]);

  const saving = updateZone.isPending;
  const unitIdForSave = zone?.unitId ?? "";

  const updateRow = (rowId: string, patch: Partial<TranslationRow>) => {
    setRows((current) =>
      current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    );
  };

  const saveProfile = () => {
    const translations = rows
      .filter((row) => row.language.trim())
      .map((row) => ({
        language: row.language.trim(),
        ...(row.title.trim() ? { title: row.title.trim() } : {}),
        ...(row.description.trim()
          ? { description: row.description.trim() }
          : {}),
      })) as ZoneTranslation[];
    updateZone.mutate({
      unitId: unitIdForSave,
      input: { translations },
    });
  };

  const saveConfig = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(configDraft);
    } catch {
      toast.error(t("zone:manage_config_invalid"));
      return;
    }
    const envelope = parsed as { schema?: unknown; version?: unknown };
    if (
      envelope?.schema !== ZONE_CONFIG_SCHEMA ||
      envelope?.version !== ZONE_CONFIG_V1_VERSION
    ) {
      toast.error(t("zone:manage_config_invalid"));
      return;
    }
    updateZone.mutate({
      unitId: unitIdForSave,
      input: { config: parsed as ZoneConfig },
    });
  };

  const saveLifecycle = () => {
    updateZone.mutate({
      unitId: unitIdForSave,
      input: {
        startsAt: startsAt.trim() ? startsAt.trim() : null,
        endsAt: endsAt.trim() ? endsAt.trim() : null,
      },
    });
  };

  if (isLoading || membershipQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

  if (!zone) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-md bg-surface-subtle p-6 text-sm leading-body text-text-secondary">
          {t("zone:not_found_description")}
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-md bg-surface-subtle p-6">
          <h1 className="text-lg font-semibold leading-ui text-text-primary">
            {t("zone:manage")}
          </h1>
          <p className="mt-2 text-sm leading-body text-text-secondary">
            {t("zone:manage_denied")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold leading-ui text-text-primary">
          {t("zone:manage")} · {zone.name || zone.slug}
        </h1>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange?.(value as ZoneManageTab)}
      >
        <TabsList className="mb-6 flex flex-wrap">
          <TabsTrigger value="profile">{t("zone:manage_profile")}</TabsTrigger>
          <TabsTrigger value="config">{t("zone:manage_config")}</TabsTrigger>
          <TabsTrigger value="lifecycle">
            {t("zone:manage_lifecycle")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card surface="contained">
            <CardContent className="flex flex-col gap-5 p-4">
              <div className="flex flex-col gap-4">
                {rows.map((row) => (
                  <div
                    key={row.rowId}
                    className="grid gap-3 md:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)_auto]"
                  >
                    <Field
                      label={t("common:language")}
                      htmlFor={`${row.rowId}-language`}
                    >
                      <Input
                        id={`${row.rowId}-language`}
                        value={row.language}
                        onChange={(event) =>
                          updateRow(row.rowId, { language: event.target.value })
                        }
                      />
                    </Field>
                    <Field
                      label={t("common:title")}
                      htmlFor={`${row.rowId}-title`}
                    >
                      <Input
                        id={`${row.rowId}-title`}
                        value={row.title}
                        onChange={(event) =>
                          updateRow(row.rowId, { title: event.target.value })
                        }
                      />
                    </Field>
                    <Field
                      label={t("common:description")}
                      htmlFor={`${row.rowId}-description`}
                    >
                      <Input
                        id={`${row.rowId}-description`}
                        value={row.description}
                        onChange={(event) =>
                          updateRow(row.rowId, {
                            description: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setRows((current) =>
                            current.filter(
                              (candidate) => candidate.rowId !== row.rowId,
                            ),
                          )
                        }
                      >
                        {t("common:remove")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setRows((current) => [
                      ...current,
                      {
                        rowId: makeRowId(),
                        language: "",
                        title: "",
                        description: "",
                      },
                    ])
                  }
                >
                  {t("common:add")}
                </Button>
                <Button onClick={saveProfile} disabled={saving}>
                  {t("common:save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <Card surface="contained">
            <CardContent className="flex flex-col gap-5 p-4">
              <Field label={t("zone:manage_config")} htmlFor="zone-config">
                <Textarea
                  id="zone-config"
                  value={configDraft}
                  onChange={(event) => setConfigDraft(event.target.value)}
                  rows={24}
                  spellCheck={false}
                  className="font-mono text-sm leading-body"
                />
              </Field>
              <div className="flex justify-end">
                <Button onClick={saveConfig} disabled={saving}>
                  {t("common:save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lifecycle">
          <Card surface="contained">
            <CardContent className="flex flex-col gap-5 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label={t("zone:manage_starts_at")}
                  htmlFor="zone-starts-at"
                >
                  <Input
                    id="zone-starts-at"
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                    placeholder="2026-06-09T00:00:00.000Z"
                  />
                </Field>
                <Field label={t("zone:manage_ends_at")} htmlFor="zone-ends-at">
                  <Input
                    id="zone-ends-at"
                    value={endsAt}
                    onChange={(event) => setEndsAt(event.target.value)}
                    placeholder="2026-06-30T00:00:00.000Z"
                  />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button onClick={saveLifecycle} disabled={saving}>
                  {t("common:save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
