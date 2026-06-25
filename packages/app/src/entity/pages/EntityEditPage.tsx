/**
 * Entity edit page for updating entity metadata and translations.
 * 编辑实体元数据和翻译内容的页面。
 *
 * Two-section form: entity metadata and translation controls.
 * 两个部分的表单：实体元数据和翻译控制。
 *
 * Mobile (<640px):
 * +-----40px-----+
 * |  Title       |  flex-row gap-4 responsive
 * |  [Cancel]    |
 * |  [Save]      |
 * |              |
 * |  SECTION 1   |
 * |  ----        |  gap-6 form fields
 * |  Kind, Slug  |
 * |  Avatar...   |
 * |              |
 * |  SECTION 2   |  gap-12 between sections
 * |  Language    |
 * |  Title...    |
 * +-------------+
 *
 * Tablet (640-1023px):
 * +-------60px-------+
 * |  Title  [Cancel] |  flex-row justify-between
 * |          [Save]  |
 * |  SECTION 1       |
 * |  Kind, Slug...   |  flex-col gap-6
 * |                  |
 * |  SECTION 2       |
 * |  Language Bar    |
 * |  Title, Subtitle |
 * +------------------+
 *
 * Desktop (1024-1535px):
 * +-------80px-------+
 * | Title   [Cancel] |  max-w-3xl centered
 * |          [Save]  |  mb-10 spacing
 * |                  |
 * | ENTITY SECTION   |  gap-6 inputs
 * | Kind             |
 * | Slug             |
 * | Avatar           |
 * | Verified         |
 * |                  |
 * | TRANSLATION SEC  |
 * | Language Bar     |
 * | Title, Subtitle  |
 * | Summary          |
 * | Description      |
 * +------------------+
 *
 * Ultra-wide (>=1536px):
 * +----------100px-----------+
 * |  Title          [Cancel] |  max-w-3xl constraint
 * |                  [Save]  |  flex-col gap-12
 * |                          |
 * |  ENTITY / TRANSLATION    |
 * |  SECTIONS WITH FULL WID  |
 * +-------------------------+
 */

import {
  entityKeys,
  useEntity,
  useUpdateEntity,
} from "@rezics/contract/api/entity";
import { useServerPermission } from "@rezics/contract/api/hooks/useServerPermission";
import type { EntityDTO, EntityKind } from "@rezics/contract";
import {
  BasicAdminPermission,
  contentDocMarkdownFallback,
  DEFAULT_LANGUAGE,
  entityKinds,
  markdownContentDoc,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
} from "@rezics/ui/shadcn";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  isApiNotFoundError,
  QueryErrorDisplay,
  ResourceNotFoundState,
} from "@/core";
import { ImageUploadField } from "@/shared/ui/ImageUploadField";
import {
  AddUnitTranslationLanguageDialog,
  UnitTranslationLanguageBar,
} from "@/unit";

interface EntityEditPageProps {
  unitId: string;
}

const NO_KIND = "__none__";

export function EntityEditPage({ unitId }: EntityEditPageProps) {
  const { t } = useTranslation(["common", "entity"]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const permission = useServerPermission();
  const canEdit = permission ? BasicAdminPermission(permission) : false;
  const { data: entity, isLoading, error } = useEntity(unitId);
  const updateEntity = useUpdateEntity();

  const existingLanguages = useMemo(
    () => getExistingLanguages(entity),
    [entity],
  );
  const [selectedLanguage, setSelectedLanguage] =
    useState<string>(DEFAULT_LANGUAGE);
  const [draftLanguages, setDraftLanguages] = useState<string[]>([]);
  const editableLanguages = useMemo(
    () => [
      ...existingLanguages,
      ...draftLanguages.filter(
        (language) => !existingLanguages.includes(language),
      ),
    ],
    [draftLanguages, existingLanguages],
  );
  const [addOpen, setAddOpen] = useState(false);

  const [kind, setKind] = useState(NO_KIND);
  const [avatar, setAvatar] = useState("");
  const [verified, setVerified] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");

  // Guard: only seed entity metadata into form state once, not on every background refetch.
  // 守卫：仅在首次加载时将实体元数据填入表单状态，不在后台重新获取时覆盖。
  const entityInitializedRef = useRef(false);
  // Guard: re-seed translation fields when the user switches language, but not on same-language refetch.
  // 守卫：当用户切换语言时重新填充翻译字段，但同一语言的后台刷新不覆盖。
  const translationInitLangRef = useRef<string | null>(null);

  const translation = entity?.translations?.find(
    (item) => item.language === selectedLanguage,
  );

  useEffect(() => {
    if (!isLoading && !canEdit) {
      navigate({ to: "/entity/$unitId", params: { unitId }, replace: true });
    }
  }, [canEdit, isLoading, navigate, unitId]);

  useEffect(() => {
    if (entityInitializedRef.current || !entity) return;
    entityInitializedRef.current = true;
    setKind(entity.kind ?? NO_KIND);
    setAvatar(entity.avatar ?? "");
    setVerified(entity.verified);
    setSlug(entity.slug ?? "");
  }, [entity]);

  useEffect(() => {
    if (
      editableLanguages.length > 0 &&
      !editableLanguages.includes(selectedLanguage)
    ) {
      setSelectedLanguage(editableLanguages[0] ?? DEFAULT_LANGUAGE);
    }
  }, [editableLanguages, selectedLanguage]);

  useEffect(() => {
    if (translationInitLangRef.current === selectedLanguage) return;
    translationInitLangRef.current = selectedLanguage;
    setTitle(translation?.title ?? "");
    setSubtitle(translation?.subtitle ?? "");
    setSummary(translation?.summary ?? "");
    setDescription(contentDocMarkdownFallback(translation?.description));
  }, [translation, selectedLanguage]);

  const handleAddLanguage = (language: string) => {
    setAddOpen(false);
    setDraftLanguages((prev) =>
      prev.includes(language) ? prev : [...prev, language],
    );
    setSelectedLanguage(language);
    setTitle("");
    setSubtitle("");
    setSummary("");
    setDescription("");
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    try {
      const updated = await updateEntity.mutateAsync({
        unitId,
        input: {
          patch: {
            entity: {
              kind: kind === NO_KIND ? null : (kind as EntityKind),
              avatar: avatar.trim() || null,
              verified,
              slug: slug.trim() ? slug.trim() : null,
            },
            translations: {
              [selectedLanguage]: {
                title: title.trim(),
                subtitle: subtitle.trim() || null,
                summary: summary.trim() || null,
                description: description.trim()
                  ? markdownContentDoc(description)
                  : null,
              },
            },
          },
        },
      });

      if (updated.slug) {
        queryClient.setQueryData(entityKeys.bySlug(updated.slug), updated);
      }

      navigate({ to: "/entity/$unitId", params: { unitId } });
    } catch {
      // Global MutationCache.onError already shows a toast; catch only prevents unhandled rejection.
      // 全局 MutationCache.onError 已显示 toast；此处仅捕获以防止未处理的 rejection。
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error || !entity) {
    return error && !isApiNotFoundError(error) ? (
      <div className="w-full mx-auto max-w-3xl px-4 py-12">
        <QueryErrorDisplay error={error} />
      </div>
    ) : (
      <ResourceNotFoundState variant="section" />
    );
  }

  if (!canEdit) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-10 flex flex-row items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t("entity:edit_title")}</h1>
        <div className="flex flex-row items-center gap-2">
          <Button
            variant="ghost"
            onClick={() =>
              navigate({ to: "/entity/$unitId", params: { unitId } })
            }
          >
            {t("common:cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || updateEntity.isPending}
          >
            {t("common:save")}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-12">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {t("entity:section_entity")}
          </h2>
          <Separator className="mb-6" />
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="entity-kind">{t("entity:kind_label")}</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="entity-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={NO_KIND}>
                      {t("entity:kind_unspecified")}
                    </SelectItem>
                    {entityKinds.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="entity-slug">{t("entity:slug_label")}</Label>
              <Input
                id="entity-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
            </div>
            <ImageUploadField
              value={avatar || null}
              onChange={(url) => setAvatar(url ?? "")}
              label={t("entity:avatar_url")}
            />
            <Label
              htmlFor="entity-verified"
              className="flex flex-row items-center gap-2 text-sm"
            >
              <Checkbox
                id="entity-verified"
                checked={verified}
                onCheckedChange={(value) => setVerified(value === true)}
              />
              {t("entity:verified")}
            </Label>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {t("common:translation")}
          </h2>
          <Separator className="mb-6" />
          <div className="flex flex-col gap-6">
            <UnitTranslationLanguageBar
              existingLanguages={editableLanguages}
              selectedLanguage={selectedLanguage}
              onSelect={setSelectedLanguage}
              onAddClick={() => setAddOpen(true)}
              label={t("common:language")}
              addLabel={t("common:add_translation")}
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="entity-title">{t("entity:title_label")}</Label>
              <Input
                id="entity-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="entity-subtitle">
                {t("entity:subtitle_label")}
              </Label>
              <Input
                id="entity-subtitle"
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="entity-summary">
                {t("entity:summary_label")}
              </Label>
              <Textarea
                id="entity-summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="entity-description">
                {t("entity:description_label")}
              </Label>
              <Textarea
                id="entity-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
              />
            </div>
          </div>
        </section>
      </div>

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

function getExistingLanguages(entity: EntityDTO | undefined): string[] {
  return (entity?.translations ?? [])
    .map((translation) => translation.language as string | undefined)
    .filter((language): language is string => Boolean(language));
}
