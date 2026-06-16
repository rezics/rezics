import { patchTranslationDetailQueries } from "@rezics/api/react-query/cache-coherence";
import { realmKeys } from "@rezics/api/realm/realm";
import { unitApi } from "@rezics/api/unit/unit";
import {
  contentDocMarkdownFallback,
  DEFAULT_LANGUAGE,
  markdownContentDoc,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Button, Input, Label, Textarea } from "@rezics/ui/shadcn";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AddUnitTranslationLanguageDialog,
  UnitTranslationLanguageBar,
} from "@/unit";
import { useRealmManage } from "../../layouts/realmManageContext";
import {
  AvatarPicker,
  BannerPicker,
  SlotPicker,
} from "../../sections/RealmManageEditors";

/**
 * Realm profile management page for translations, description, slots, avatar,
 * and banner. The language toolbar can overflow horizontally while the form
 * remains full-width within the management shell.
 *
 * Realm 资料管理页：编辑译文、简介、slot、头像与横幅。语言工具栏在窄屏可横向
 * 处理，表单在管理布局中占满可用宽度。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Language bar             │
 * │ Name                     │
 * │ Description              │
 * │                  [Save]  │
 * │ Slot / Avatar / Banner   │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Language bar                       │
 * │ Name / Description                 │
 * │ Slot editors stacked full width    │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Language bar                               │
 * │ Form fields and editors in one column      │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │ Centered max-width content from layout     │
 * │ Profile editors stay readable, not wider   │
 * └────────────────────────────────────────────┘
 */
export function RealmManageProfilePage() {
  const { t } = useTranslation(["common", "community"]);
  const queryClient = useQueryClient();
  const { realmId, realm } = useRealmManage();
  const existingLanguages = useMemo(
    () =>
      (realm.translations ?? [])
        .map((translation) => translation.language as string | undefined)
        .filter((language): language is string => Boolean(language)),
    [realm.translations],
  );
  const [selectedLanguage, setSelectedLanguage] =
    useState<string>(DEFAULT_LANGUAGE);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draftLanguages, setDraftLanguages] = useState<string[]>([]);
  const syncedLanguageRef = useRef<string | null>(null);
  const editableLanguages = useMemo(
    () => [
      ...existingLanguages,
      ...draftLanguages.filter(
        (language) => !existingLanguages.includes(language),
      ),
    ],
    [draftLanguages, existingLanguages],
  );
  const translation = realm.translations?.find(
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
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setSaving(true);
    try {
      const translation = await unitApi.upsertTranslation(
        realmId,
        selectedLanguage,
        {
          title: trimmedTitle,
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
      toast.error(
        error instanceof Error ? error.message : t("common:error_generic"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
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
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="realm-description">{t("common:description")}</Label>
        <Textarea
          id="realm-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !title.trim()}>
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
      <SlotPicker realmId={realmId} slotKey="rule" value={realm.extra?.rule} />
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
