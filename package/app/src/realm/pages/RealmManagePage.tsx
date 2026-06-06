import { useServerPermission } from "@rezics/api/hooks";
import { getDefaultRealmId } from "@rezics/api/infra/bootstrap";
import { patchTranslationDetailQueries } from "@rezics/api/react-query/cache-coherence";
import {
  myRealmMembershipQuery,
  realmDetailQuery,
  realmKeys,
  useDeleteRealmMutation,
  useUpdateRealmMutation,
} from "@rezics/api/realm/realm";
import { unitApi } from "@rezics/api/unit/unit";
import {
  contentDocMarkdownFallback,
  DEFAULT_LANGUAGE,
  markdownContentDoc,
  type RealmDTO,
  type TagTreeNode,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@rezics/ui/shadcn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { PinboardAdminSection } from "@/pinboard";
import { unitHref } from "@/shared/ui/link";
import {
  AddUnitTranslationLanguageDialog,
  UnitTranslationLanguageBar,
} from "@/unit";
import { RealmMemberList } from "../components/RealmMemberList";
import { canManageRealm } from "../models/canManageRealm";
import {
  BannerPicker,
  SlotPicker,
  TagTreeEditor,
  TagViewPreferenceEditor,
  WikiZonePicker,
} from "../sections/RealmManageEditors";
import { RealmModerationQueueSection } from "../sections/RealmModerationQueueSection";

type RealmManageTab =
  | "profile"
  | "organization"
  | "wiki"
  | "moderation"
  | "members"
  | "danger";

interface RealmManagePageProps {
  realmId: string;
  activeTab?: RealmManageTab;
  onTabChange?: (tab: RealmManageTab) => void;
}

export function RealmManagePage({
  realmId,
  activeTab = "profile",
  onTabChange,
}: RealmManagePageProps) {
  const { t } = useTranslation(["common", "entity"]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    data: realm,
    error: realmError,
    isError: realmIsError,
    isLoading,
  } = useQuery(realmDetailQuery(realmId));
  const { data: membership, isLoading: membershipLoading } = useQuery(
    myRealmMembershipQuery(realmId),
  );
  const permission = useServerPermission();
  const updateRealm = useUpdateRealmMutation({
    onSuccess: () => toast.success("Realm settings saved."),
    onError: (error) => toast.error(error.message),
  });

  const existingLanguages = useMemo(
    () =>
      (realm?.translations ?? [])
        .map((translation) => translation.language as string | undefined)
        .filter((language): language is string => Boolean(language)),
    [realm?.translations],
  );
  const [selectedLanguage, setSelectedLanguage] =
    useState<string>(DEFAULT_LANGUAGE);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draftLanguages, setDraftLanguages] = useState<string[]>([]);
  const canDeleteRealm =
    membership?.roleKey === "owner" ||
    membership?.roleKey === "admin" ||
    permission?.role === "ROOT";
  const editableLanguages = useMemo(
    () => [
      ...existingLanguages,
      ...draftLanguages.filter(
        (language) => !existingLanguages.includes(language),
      ),
    ],
    [draftLanguages, existingLanguages],
  );

  const allowed = canManageRealm({
    permission,
    memberRoleKey: membership?.roleKey,
  });

  useEffect(() => {
    if (!isLoading && !membershipLoading && !allowed) {
      navigate({
        to: unitHref({
          type: "REALM",
          unitId: realmId,
          slug: realm?.slug ?? null,
        }),
      });
    }
  }, [isLoading, membershipLoading, allowed, navigate, realmId, realm?.slug]);

  const translation = realm?.translations?.find(
    (item) => item.language === selectedLanguage,
  );

  useEffect(() => {
    if (
      editableLanguages.length > 0 &&
      !editableLanguages.includes(selectedLanguage)
    ) {
      setSelectedLanguage(editableLanguages[0] ?? DEFAULT_LANGUAGE);
    }
  }, [editableLanguages, selectedLanguage]);

  useEffect(() => {
    setTitle(translation?.title ?? "");
    setDescription(contentDocMarkdownFallback(translation?.description));
  }, [translation]);

  const handleAddLanguage = (language: string) => {
    setAddOpen(false);
    setDraftLanguages((prev) =>
      prev.includes(language) ? prev : [...prev, language],
    );
    setSelectedLanguage(language);
    setTitle("");
    setDescription("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const translation = await unitApi.upsertTranslation(
        realmId,
        selectedLanguage,
        {
          title,
          description: markdownContentDoc(description),
        },
      );

      await patchTranslationDetailQueries({
        queryClient,
        detailKeys: [realmKeys.detail(realmId)],
        translation,
      });
      await queryClient.invalidateQueries({
        queryKey: realmKeys.detail(realmId),
      });

      toast.success("Realm profile saved.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || membershipLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (realmIsError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <QueryErrorDisplay error={realmError} />
      </div>
    );
  }

  if (!realm) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-md bg-surface-subtle p-6 text-sm leading-body text-text-secondary">
          Realm settings are unavailable for this realm.
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-md bg-surface-subtle p-6">
          <h1 className="text-lg font-semibold leading-ui text-text-primary">
            Realm management unavailable
          </h1>
          <p className="mt-2 text-sm leading-body text-text-secondary">
            You need owner, moderator, or staff permissions to manage this
            realm.
          </p>
        </div>
      </div>
    );
  }

  const isDefaultRealm = realmId === getDefaultRealmId();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">
        {t("entity:realm_manage")}
      </h1>
      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange?.(value as RealmManageTab)}
      >
        <TabsList className="mb-6 flex flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="wiki">Wiki</TabsTrigger>
          <TabsTrigger value="moderation">Moderation</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="danger">Danger</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <UnitTranslationLanguageBar
              existingLanguages={editableLanguages}
              selectedLanguage={selectedLanguage}
              onSelect={setSelectedLanguage}
              onAddClick={() => setAddOpen(true)}
              label={t("common:language")}
              addLabel={t("common:add_translation")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="realm-name">{t("common:name")}</Label>
            <Input
              id="realm-name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="realm-description">{t("common:description")}</Label>
            <Textarea
              id="realm-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex justify-end">
            {/* Identity save only upserts the selected translation; realm extra controls auto-save independently. */}
            <Button onClick={handleSave} disabled={saving}>
              {t("common:save")}
            </Button>
          </div>
          <SlotPicker
            realmId={realmId}
            slotKey="about"
            value={realm.extra?.about}
          />
          <BannerPicker realmId={realmId} value={realm.extra?.banner ?? null} />
          <SlotPicker
            realmId={realmId}
            slotKey="rule"
            value={realm.extra?.rule}
          />
        </TabsContent>

        <TabsContent value="organization" className="flex flex-col gap-6">
          <TagTreeEditor
            realmId={realmId}
            initialValue={realm.extra?.tagTree as TagTreeNode[] | undefined}
          />
          <TagViewPreferenceEditor
            realmId={realmId}
            initialValue={realm.extra?.tagView}
          />
          <PinboardAdminSection
            realmUnitId={realmId}
            isDefaultRealm={isDefaultRealm}
          />
        </TabsContent>

        <TabsContent value="wiki" className="flex flex-col gap-6">
          <WikiZonePicker
            realmId={realmId}
            value={realm.extra?.wikiZoneUnitId ?? null}
          />
        </TabsContent>

        <TabsContent value="moderation" className="flex flex-col gap-4">
          <Card surface="contained">
            <CardContent className="flex items-start gap-3 p-4">
              <Checkbox
                id="realm-content-approval"
                checked={realm.contentRequiresApproval ?? false}
                disabled={updateRealm.isPending}
                onCheckedChange={(checked) =>
                  updateRealm.mutate({
                    unitId: realmId,
                    input: { contentRequiresApproval: checked === true },
                  })
                }
              />
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="realm-content-approval"
                  className="text-sm font-medium leading-ui text-text-primary"
                >
                  Require content approval
                </Label>
                <p className="m-0 text-sm leading-body text-text-secondary">
                  New feed submissions wait for realm case review before
                  appearing publicly.
                </p>
              </div>
            </CardContent>
          </Card>
          <RealmModerationQueueSection realmUnitId={realmId} />
        </TabsContent>

        <TabsContent value="members">
          <RealmMemberList realmId={realmId} />
        </TabsContent>

        <TabsContent value="danger">
          <RealmOwnershipSection
            realm={realm}
            canDelete={canDeleteRealm}
            onDeleted={() => navigate({ to: "/realm" })}
          />
        </TabsContent>
      </Tabs>
      <AddUnitTranslationLanguageDialog
        open={addOpen}
        existingLanguages={editableLanguages}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddLanguage}
        title={t("common:add_translation")}
        languageLabel={t("common:language")}
        cancelLabel={t("common:cancel")}
        submitLabel={t("common:add")}
      />
    </div>
  );
}

function RealmOwnershipSection({
  realm,
  canDelete,
  onDeleted,
}: {
  realm: RealmDTO;
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteRealm = useDeleteRealmMutation({
    onSuccess: () => {
      toast.success("Realm deleted.");
      onDeleted();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <section className="flex flex-col gap-3 rounded-md bg-surface-subtle p-4">
      <div>
        <h2 className="text-lg font-semibold leading-ui text-text-primary">
          Ownership
        </h2>
        <p className="mt-1 text-sm leading-body text-text-secondary">
          Owner {realm.user?.name ?? realm.userId ?? "Unknown owner"}
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={!canDelete}
          onClick={() => setDeleteOpen(true)}
        >
          Delete realm
        </Button>
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this realm?</DialogTitle>
            <DialogDescription>
              This permanently removes the realm and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteRealm.isPending}
              onClick={() => deleteRealm.mutate(realm.unitId)}
            >
              Delete realm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default RealmManagePage;
