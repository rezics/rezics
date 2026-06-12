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
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { QueryErrorDisplay } from "@/core";
import { PinboardAdminSection } from "@/pinboard";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { unitHref } from "@/shared/ui/link";
import {
  AddUnitTranslationLanguageDialog,
  UnitTranslationLanguageBar,
} from "@/unit";
import { RealmMemberList } from "../components/RealmMemberList";
import { canManageRealm } from "../models/canManageRealm";
import {
  AvatarPicker,
  BannerPicker,
  FeaturedZonePicker,
  SlotPicker,
  TagTreeEditor,
  TagViewPreferenceEditor,
  WikiSidebarPicker,
} from "../sections/RealmManageEditors";
import { RealmModerationQueueSection } from "../sections/RealmModerationQueueSection";

/**
 * Full-page admin dashboard for managing realm settings across 6 tabs:
 * Profile (translations, bio, media), Organization (tags, views, pinboard),
 * Wiki (featured zone, sidebar), Moderation (approval settings, queue),
 * Members (member list), and Danger (delete realm).
 * Permission-gated: redirects non-managers to realm detail page.
 *
 * 用于管理社区设置的完整页面管理仪表板，包含6个选项卡：
 * 资料(翻译、简介、媒体)、组织(标签、视图、内容墙)、
 * Wiki(特色区域、侧边栏)、审核(批准设置、队列)、
 * 成员(成员列表)和危险(删除社区)。
 * 权限受控：将非管理员重定向到社区详情页面。
 *
 * Layout:
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Realm Management         │
 * ├──────────────────────────┤
 * │ [Profile][Org][Wiki]     │
 * │ [Mod][Members][Danger]   │
 * ├──────────────────────────┤
 * │ [Active Tab Content]     │
 * │ [Forms, sections, cards] │
 * │ [Scrollable vertically]  │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Realm Management                   │
 * ├────────────────────────────────────┤
 * │ [Profile][Org][Wiki][Mod]          │
 * │ [Members][Danger]                  │
 * ├────────────────────────────────────┤
 * │ [Active Tab Content]               │
 * │ [Multiple form sections]           │
 * │ [Cards in responsive layout]       │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌──────────────────────────────────────┐
 * │ Realm Management                     │
 * ├──────────────────────────────────────┤
 * │ [Profile][Org][Wiki][Mod][Mem][Danger]
 * ├──────────────────────────────────────┤
 * │ [Active Tab Content - max-width 5xl] │
 * │ [Form sections, grids, editors]     │
 * └──────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * Same as Desktop - max-width 5xl container centered
 */
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
  const { t } = useTranslation(["common", "entity", "community"]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const readContext = useReadLanguageContext();
  const {
    data: realm,
    error: realmError,
    isError: realmIsError,
    isLoading,
  } = useQuery({
    ...realmDetailQuery(realmId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready,
  });
  const { data: membership, isLoading: membershipLoading } = useQuery(
    myRealmMembershipQuery(realmId),
  );
  const permission = useServerPermission();
  const updateRealm = useUpdateRealmMutation({
    onSuccess: () => toast.success(t("community:realm_settings_saved")),
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
  // Track which language has been synced to form state to prevent refetch overwrites
  // 记录已同步到表单状态的语言，防止 refetch 覆盖未保存的编辑
  const syncedLanguageRef = useRef<string | null>(null);
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
      // Replace history entry so Back doesn't re-trigger the redirect loop.
      // 替换历史条目，避免 Back 键重新触发重定向循环。
      navigate({
        to: unitHref({
          type: "REALM",
          unitId: realmId,
          slug: realm?.slug ?? null,
        }),
        replace: true,
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
    if (!translation) return;
    if (syncedLanguageRef.current === selectedLanguage) return;
    syncedLanguageRef.current = selectedLanguage;
    setTitle(translation.title ?? "");
    setDescription(contentDocMarkdownFallback(translation.description));
  }, [translation, selectedLanguage]);

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

      toast.success(t("community:realm_profile_saved"));
    } catch (error) {
      // Raw API call — no global MutationCache.onError; show error feedback manually.
      // 原始 API 调用——无全局 MutationCache.onError；需手动显示错误反馈。
      toast.error(
        error instanceof Error ? error.message : t("common:error_generic"),
      );
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
          {t("community:realm_settings_unavailable")}
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-md bg-surface-subtle p-6">
          <h1 className="text-lg font-semibold leading-ui text-text-primary">
            {t("community:realm_management_unavailable")}
          </h1>
          <p className="mt-2 text-sm leading-body text-text-secondary">
            {t("community:realm_management_permission_required")}
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
          <TabsTrigger value="profile">
            {t("community:realm_manage_tab_profile")}
          </TabsTrigger>
          <TabsTrigger value="organization">
            {t("community:realm_manage_tab_organization")}
          </TabsTrigger>
          <TabsTrigger value="wiki">
            {t("community:realm_manage_tab_wiki")}
          </TabsTrigger>
          <TabsTrigger value="moderation">
            {t("community:realm_manage_tab_moderation")}
          </TabsTrigger>
          <TabsTrigger value="members">
            {t("community:realm_manage_tab_members")}
          </TabsTrigger>
          <TabsTrigger value="danger">
            {t("community:realm_manage_tab_danger")}
          </TabsTrigger>
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
            {/* 身份保存仅 upsert 选中的翻译；realm 的额外控件各自独立自动保存。 */}
            <Button onClick={handleSave} disabled={saving}>
              {t("common:save")}
            </Button>
          </div>
          <SlotPicker
            realmId={realmId}
            slotKey="about"
            value={realm.extra?.about}
          />
          <AvatarPicker realmId={realmId} value={realm.extra?.avatar ?? null} />
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
          <FeaturedZonePicker
            realmId={realmId}
            value={realm.extra?.featuredZoneUnitId ?? null}
          />
          <WikiSidebarPicker
            realmId={realmId}
            value={realm.extra?.wikiSidebar ?? null}
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
                  {t("community:realm_require_content_approval")}
                </Label>
                <p className="m-0 text-sm leading-body text-text-secondary">
                  {t("community:realm_require_content_approval_description")}
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
  const { t } = useTranslation(["common", "community"]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteRealm = useDeleteRealmMutation({
    onSuccess: () => {
      toast.success(t("community:realm_deleted"));
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
          {t("community:realm_ownership")}
        </h2>
        <p className="mt-1 text-sm leading-body text-text-secondary">
          {t("community:realm_owner")}{" "}
          {realm.user?.name ??
            realm.userId ??
            t("community:realm_unknown_owner")}
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={!canDelete}
          onClick={() => setDeleteOpen(true)}
        >
          {t("community:realm_delete")}
        </Button>
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("community:realm_delete_confirm_title")}
            </DialogTitle>
            <DialogDescription>
              {t("community:realm_delete_confirm_description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteRealm.isPending}
              onClick={() => deleteRealm.mutate(realm.unitId)}
            >
              {t("community:realm_delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
