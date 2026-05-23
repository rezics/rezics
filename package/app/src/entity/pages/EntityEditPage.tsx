import { entityKeys, useEntity, useUpdateEntity } from "@rezics/api/entity";
import { useServerPermission } from "@rezics/api/hooks";
import type { EntityDTO, EntityKind } from "@rezics/contract";
import {
  BasicAdminPermission,
  DEFAULT_LANGUAGE,
  entityKinds,
} from "@rezics/contract";
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
import { useEffect, useMemo, useState } from "react";
import * as m from "@rezics/i18n/messages";
import {
  AddUnitTranslationLanguageDialog,
  UnitTranslationLanguageBar,
} from "@/unit";

interface EntityEditPageProps {
  unitId: string;
}

const NO_KIND = "__none__";

function getExistingLanguages(entity: EntityDTO | undefined): string[] {
  return (entity?.translations ?? [])
    .map((translation) => translation.language as string | undefined)
    .filter((language): language is string => Boolean(language));
}

export function EntityEditPage({ unitId }: EntityEditPageProps) {
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
  const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_LANGUAGE);
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

  const translation = entity?.translations?.find(
    (item) => item.language === selectedLanguage,
  );

  useEffect(() => {
    if (!isLoading && !canEdit) {
      navigate({ to: "/entity/$unitId", params: { unitId } });
    }
  }, [canEdit, isLoading, navigate, unitId]);

  useEffect(() => {
    if (!entity) return;
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
    setTitle(translation?.title ?? "");
    setSubtitle(translation?.subtitle ?? "");
    setSummary(translation?.summary ?? "");
    setDescription(translation?.description ?? "");
  }, [translation]);

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
              description: description.trim() || null,
            },
          },
        },
      },
    });

    if (updated.slug) {
      queryClient.setQueryData(entityKeys.bySlug(updated.slug), updated);
    }

    navigate({ to: "/entity/$unitId", params: { unitId } });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-lg font-semibold text-text-primary">
          Entity not found
        </h1>
      </div>
    );
  }

  if (!canEdit) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-10 flex flex-row items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{m.entity_edit_title()}</h1>
        <div className="flex flex-row items-center gap-2">
          <Button
            variant="ghost"
            onClick={() =>
              navigate({ to: "/entity/$unitId", params: { unitId } })
            }
          >
            {m.common_cancel()}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || updateEntity.isPending}
          >
            {m.common_save()}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-12">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {m.entity_section_entity()}
          </h2>
          <Separator className="mb-6" />
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="entity-kind">{m.entity_kind_label()}</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="entity-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={NO_KIND}>
                      {m.entity_kind_unspecified()}
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
              <Label htmlFor="entity-slug">{m.entity_slug_label()}</Label>
              <Input
                id="entity-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="entity-avatar">{m.entity_avatar_url()}</Label>
              <Input
                id="entity-avatar"
                value={avatar}
                onChange={(event) => setAvatar(event.target.value)}
              />
            </div>
            <Label
              htmlFor="entity-verified"
              className="flex flex-row items-center gap-2 text-sm"
            >
              <Checkbox
                id="entity-verified"
                checked={verified}
                onCheckedChange={(value) => setVerified(value === true)}
              />
              {m.entity_verified()}
            </Label>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {m.common_translation()}
          </h2>
          <Separator className="mb-6" />
          <div className="flex flex-col gap-6">
            <UnitTranslationLanguageBar
              existingLanguages={editableLanguages}
              selectedLanguage={selectedLanguage}
              onSelect={setSelectedLanguage}
              onAddClick={() => setAddOpen(true)}
              label={m.common_language()}
              addLabel={m.common_add_translation()}
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="entity-title">{m.entity_title_label()}</Label>
              <Input
                id="entity-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="entity-subtitle">
                {m.entity_subtitle_label()}
              </Label>
              <Input
                id="entity-subtitle"
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="entity-summary">{m.entity_summary_label()}</Label>
              <Textarea
                id="entity-summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="entity-description">
                {m.entity_description_label()}
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
        title={m.common_add_translation()}
        languageLabel={m.common_language()}
        cancelLabel={m.common_cancel()}
        submitLabel={m.common_add()}
      />
    </div>
  );
}
