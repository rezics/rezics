import { useServerPermission } from "@rezics/api/hooks";
import { myRealmMembershipQuery } from "@rezics/api/realm/realm";
import {
  useUpdateZone,
  zoneByUnitIdQueryOptions,
  zoneQueryOptions,
} from "@rezics/api/zone/zone";
import type {
  ZoneFilters,
  ZonePages,
  ZoneSection,
  ZoneTheme,
} from "@rezics/contract";
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
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { QueryErrorDisplay } from "@/core";
import { canManageZone } from "../models/canManageZone";
import {
  formatJsonDraft,
  nullableText,
  optionalText,
  parseJsonDraft,
} from "../models/zoneManageDraft";

type ZoneManageTab = "profile" | "sections" | "theme" | "lifecycle";

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

export function ZoneManagePage({
  unitId,
  slug,
  activeTab = "profile",
  onTabChange,
}: ZoneManagePageProps) {
  const byUnitIdQuery = useQuery(zoneByUnitIdQueryOptions(unitId ?? ""));
  const bySlugQuery = useQuery(zoneQueryOptions(slug ?? ""));
  const zone = unitId ? byUnitIdQuery.data : bySlugQuery.data;
  const isLoading = unitId ? byUnitIdQuery.isLoading : bySlugQuery.isLoading;
  const isError = unitId ? byUnitIdQuery.isError : bySlugQuery.isError;
  const error = unitId ? byUnitIdQuery.error : bySlugQuery.error;

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
    onSuccess: () => toast.success("Zone settings saved."),
    onError: (error) => toast.error(error.message),
  });

  const [template, setTemplate] = useState("");
  const [ownerRealmUnitId, setOwnerRealmUnitId] = useState("");
  const [primaryRealmUnitId, setPrimaryRealmUnitId] = useState("");
  const [filtersDraft, setFiltersDraft] = useState("{}");
  const [pagesDraft, setPagesDraft] = useState("null");
  const [sectionsDraft, setSectionsDraft] = useState("null");
  const [themeDraft, setThemeDraft] = useState("null");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  useEffect(() => {
    if (!zone) return;
    setTemplate(zone.template);
    setOwnerRealmUnitId(zone.ownerRealmUnitId);
    setPrimaryRealmUnitId(zone.primaryRealmUnitId ?? "");
    setFiltersDraft(formatJsonDraft(zone.filters ?? {}));
    setPagesDraft(formatJsonDraft(zone.pages));
    setSectionsDraft(formatJsonDraft(zone.sections));
    setThemeDraft(formatJsonDraft(zone.theme));
    setStartsAt(zone.startsAt ?? "");
    setEndsAt(zone.endsAt ?? "");
  }, [zone]);

  const saving = updateZone.isPending;
  const unitIdForSave = zone?.unitId ?? "";

  const saveProfile = () => {
    updateZone.mutate({
      unitId: unitIdForSave,
      input: {
        ownerRealmUnitId: ownerRealmUnitId.trim(),
        primaryRealmUnitId: nullableText(primaryRealmUnitId),
        template: template.trim(),
        filters: parseJsonDraft<ZoneFilters>("Filters", filtersDraft),
      },
    });
  };

  const saveSections = () => {
    updateZone.mutate({
      unitId: unitIdForSave,
      input: {
        pages: parseJsonDraft<ZonePages | null>("Pages", pagesDraft),
        sections: parseJsonDraft<ZoneSection[] | null>(
          "Sections",
          sectionsDraft,
        ),
      },
    });
  };

  const saveTheme = () => {
    updateZone.mutate({
      unitId: unitIdForSave,
      input: {
        theme: parseJsonDraft<ZoneTheme | null>("Theme", themeDraft),
      },
    });
  };

  const saveLifecycle = () => {
    updateZone.mutate({
      unitId: unitIdForSave,
      input: {
        startsAt: optionalText(startsAt) ?? null,
        endsAt: optionalText(endsAt) ?? null,
      },
    });
  };

  const title = useMemo(() => zone?.name ?? zone?.slug ?? "Zone", [zone]);

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
          Zone settings are unavailable for this zone.
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-md bg-surface-subtle p-6">
          <h1 className="text-lg font-semibold leading-ui text-text-primary">
            Zone management unavailable
          </h1>
          <p className="mt-2 text-sm leading-body text-text-secondary">
            You need owner-realm manager or staff permissions to manage this
            zone.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold leading-ui text-text-primary">
          Manage {title}
        </h1>
        <p className="mt-2 text-sm leading-body text-text-secondary">
          Owner realm: {zone.ownerRealmUnitId}
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange?.(value as ZoneManageTab)}
      >
        <TabsList className="mb-6 flex flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card surface="contained">
            <CardContent className="flex flex-col gap-5 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Template" htmlFor="zone-template">
                  <Input
                    id="zone-template"
                    value={template}
                    onChange={(event) => setTemplate(event.target.value)}
                  />
                </Field>
                <Field label="Owner realm Unit id" htmlFor="zone-owner-realm">
                  <Input
                    id="zone-owner-realm"
                    value={ownerRealmUnitId}
                    onChange={(event) =>
                      setOwnerRealmUnitId(event.target.value)
                    }
                  />
                </Field>
                <Field
                  label="Primary realm Unit id"
                  htmlFor="zone-primary-realm"
                >
                  <Input
                    id="zone-primary-realm"
                    value={primaryRealmUnitId}
                    onChange={(event) =>
                      setPrimaryRealmUnitId(event.target.value)
                    }
                  />
                </Field>
              </div>
              <Field label="Filters JSON" htmlFor="zone-filters">
                <Textarea
                  id="zone-filters"
                  value={filtersDraft}
                  onChange={(event) => setFiltersDraft(event.target.value)}
                  rows={12}
                  spellCheck={false}
                  className="font-mono text-sm leading-body"
                />
              </Field>
              <div className="flex justify-end">
                <Button onClick={saveProfile} disabled={saving}>
                  Save profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections">
          <Card surface="contained">
            <CardContent className="flex flex-col gap-5 p-4">
              <Field label="Pages JSON" htmlFor="zone-pages">
                <Textarea
                  id="zone-pages"
                  value={pagesDraft}
                  onChange={(event) => setPagesDraft(event.target.value)}
                  rows={16}
                  spellCheck={false}
                  className="font-mono text-sm leading-body"
                />
              </Field>
              <Field label="Legacy sections JSON" htmlFor="zone-sections">
                <Textarea
                  id="zone-sections"
                  value={sectionsDraft}
                  onChange={(event) => setSectionsDraft(event.target.value)}
                  rows={10}
                  spellCheck={false}
                  className="font-mono text-sm leading-body"
                />
              </Field>
              <div className="flex justify-end">
                <Button onClick={saveSections} disabled={saving}>
                  Save sections
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="theme">
          <Card surface="contained">
            <CardContent className="flex flex-col gap-5 p-4">
              <Field label="Theme JSON" htmlFor="zone-theme">
                <Textarea
                  id="zone-theme"
                  value={themeDraft}
                  onChange={(event) => setThemeDraft(event.target.value)}
                  rows={16}
                  spellCheck={false}
                  className="font-mono text-sm leading-body"
                />
              </Field>
              <div className="flex justify-end">
                <Button onClick={saveTheme} disabled={saving}>
                  Save theme
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lifecycle">
          <Card surface="contained">
            <CardContent className="flex flex-col gap-5 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Starts at" htmlFor="zone-starts-at">
                  <Input
                    id="zone-starts-at"
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                    placeholder="2026-06-09T00:00:00.000Z"
                  />
                </Field>
                <Field label="Ends at" htmlFor="zone-ends-at">
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
                  Save lifecycle
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
