import { useEntity, useUpdateEntity } from "@rezics/api/entity";
import type { EntityKind } from "@rezics/contract";
import { entityKinds, validateSlug } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { Link } from "@/shared/ui/link";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Checkbox,
  Input,
  Label,
  Separator,
} from "@rezics/ui/shadcn";
import {
  ArrowLeft as ArrowBackIcon,
  Plus as AddIcon,
  Save as SaveIcon,
  Trash2 as TrashIcon,
} from "lucide-react";
import React from "react";
import { Page } from "@/core/layouts/Page";
import { Route } from "@/routes/_admin/entities/$unitId";
import * as m from "@rezics/i18n/messages";

interface TranslationDraft {
  _draftId: string;
  language: string;
  title: string;
  subtitle?: string;
  summary?: string;
  description?: string;
  _removed?: boolean;
}

function createTranslationDraft(
  draft: Omit<TranslationDraft, "_draftId">,
): TranslationDraft {
  return {
    _draftId: crypto.randomUUID(),
    ...draft,
  };
}

export default function EntityEditPage() {
  const { unitId } = Route.useParams();
  const entityQuery = useEntity(unitId);
  const [error, setError] = React.useState<string | null>(null);

  const updateMutation = useUpdateEntity({
    onError: (err) =>
      setError(
        err instanceof Error ? err.message : m.admin_unit_update_failed(),
      ),
    onSuccess: () => setError(null),
  });

  const [kind, setKind] = React.useState<EntityKind | "">("");
  const [avatar, setAvatar] = React.useState("");
  const [verified, setVerified] = React.useState(false);
  const [slugInput, setSlugInput] = React.useState("");
  const [translations, setTranslations] = React.useState<TranslationDraft[]>(
    [],
  );

  React.useEffect(() => {
    const entity = entityQuery.data;
    if (!entity) return;
    setKind(entity.kind ?? "");
    setAvatar(entity.avatar ?? "");
    setVerified(Boolean(entity.verified));
    setSlugInput(entity.slug ?? "");
    setTranslations(
      (entity.translations ?? []).map((t) =>
        createTranslationDraft({
          language: t.language,
          title: t.title ?? "",
          subtitle: t.subtitle ?? "",
          summary: t.summary ?? "",
          description: t.description ?? "",
        }),
      ),
    );
  }, [entityQuery.data]);

  const slugValidation = React.useMemo(() => {
    const trimmed = slugInput.trim();
    if (!trimmed) return { ok: true as const };
    return validateSlug(trimmed, { scope: "entity" });
  }, [slugInput]);

  const canSubmitSlug = verified && slugValidation.ok;
  const slugError = slugValidation.ok ? null : slugValidation.reason;

  const handleAddTranslation = () => {
    setTranslations((prev) => [
      ...prev,
      createTranslationDraft({
        language: "",
        title: "",
        subtitle: "",
        summary: "",
        description: "",
      }),
    ]);
  };

  const handleRemoveTranslation = (index: number) => {
    setTranslations((prev) =>
      prev.map((t, i) => (i === index ? { ...t, _removed: true } : t)),
    );
  };

  const handleTranslationChange = (
    index: number,
    field: keyof TranslationDraft,
    value: string,
  ) => {
    setTranslations((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    );
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const wantsSlug = slugInput.trim() !== (entityQuery.data?.slug ?? "");
    if (wantsSlug && slugInput.trim() && !verified) {
      setError(m.admin_entity_slug_requires_verified());
      return;
    }
    if (wantsSlug && slugInput.trim() && !slugValidation.ok) {
      setError(m.admin_entity_slug_invalid({ reason: slugError ?? "" }));
      return;
    }

    const liveTranslations = translations
      .filter((t) => !t._removed)
      .filter((t) => t.language.trim() && (t.title ?? "").trim())
      .map((t) => ({
        language: t.language.trim(),
        title: (t.title ?? "").trim(),
        subtitle: (t.subtitle ?? "").trim() || undefined,
        summary: (t.summary ?? "").trim() || undefined,
        description: (t.description ?? "").trim() || undefined,
      }));

    await updateMutation.mutateAsync({
      unitId,
      input: {
        kind: kind || undefined,
        avatar: avatar.trim() || null,
        verified,
        slug: wantsSlug ? slugInput.trim() || null : undefined,
        translations:
          liveTranslations.length > 0 ? liveTranslations : undefined,
      },
    });
    await entityQuery.refetch();
  }

  if (entityQuery.isLoading) {
    return (
      <Page title={m.admin_entity_edit_title()} description={unitId}>
        <Card>
          <CardContent>
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          </CardContent>
        </Card>
      </Page>
    );
  }

  if (entityQuery.isError || !entityQuery.data) {
    return (
      <Page title={m.admin_entity_edit_title()} description={unitId}>
        <Card>
          <CardContent>
            <Alert>
              <AlertDescription className="text-error-text">
                {m.admin_entity_failed_load()}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title={m.admin_entity_edit_title()}
      description={m.admin_entity_edit_description({ unitId })}
    >
      <Card>
        <CardContent>
          <div className="flex flex-row items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              render={(props) => (
                <Link to="/entities" {...props}>
                  <ArrowBackIcon className="size-4" />
                  {m.common_back()}
                </Link>
              )}
            />
            <div className="flex-1" />
          </div>

          <Separator className="my-4" />

          {error ? (
            <Alert className="mb-4">
              <AlertDescription className="text-error-text">
                {error}
              </AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-6">
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="entity-kind">{m.common_type()}</Label>
                  <select
                    id="entity-kind"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as EntityKind | "")}
                    className="h-9 rounded-md border border-border-whisper bg-transparent px-2 text-sm"
                  >
                    <option value="">{m.common_none()}</option>
                    {entityKinds.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{m.admin_entity_verified()}</Label>
                  <div className="flex items-center gap-3 h-9">
                    <Checkbox
                      checked={verified}
                      onCheckedChange={(value) => setVerified(value === true)}
                      id="entity-verified"
                    />
                    <span className="text-sm text-text-secondary">
                      {verified
                        ? m.admin_entity_verified_slug_allowed()
                        : m.admin_entity_unverified_slug_disabled()}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="entity-avatar">
                    {m.admin_entity_avatar_url()}
                  </Label>
                  <Input
                    id="entity-avatar"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    placeholder={m.admin_entity_avatar_placeholder()}
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="entity-slug">{m.common_slug()}</Label>
                  <Input
                    id="entity-slug"
                    value={slugInput}
                    onChange={(e) => setSlugInput(e.target.value)}
                    placeholder={m.admin_entity_slug_placeholder()}
                    disabled={!verified}
                  />
                  <p className="text-xs text-text-secondary">
                    {verified
                      ? m.admin_entity_slug_help_enabled()
                      : m.admin_entity_slug_help_disabled()}
                  </p>
                  {slugInput.trim() && !slugValidation.ok ? (
                    <p className="text-xs text-error-text">
                      {m.admin_entity_slug_invalid_short({
                        reason: slugValidation.reason,
                      })}
                    </p>
                  ) : null}
                </div>
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">
                    {m.admin_unit_translations()}
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddTranslation}
                  >
                    <AddIcon className="size-4" />
                    {m.common_add_translation()}
                  </Button>
                </div>
                {translations.length === 0 ? (
                  <p className="text-sm text-text-secondary">
                    {m.admin_entity_translations_empty()}
                  </p>
                ) : (
                  translations.map((tr, index) =>
                    tr._removed ? null : (
                      <div
                        key={tr._draftId}
                        className="rounded-md border border-border-whisper p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-text-secondary">
                            {m.admin_entity_translation_index({
                              index: String(index + 1),
                            })}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={m.admin_entity_remove_translation()}
                            onClick={() => handleRemoveTranslation(index)}
                          >
                            <TrashIcon className="size-4 text-text-secondary" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                          <div className="flex flex-col gap-1.5">
                            <Label>{m.common_language()}</Label>
                            <Input
                              value={tr.language}
                              onChange={(e) =>
                                handleTranslationChange(
                                  index,
                                  "language",
                                  e.target.value,
                                )
                              }
                              placeholder={m.common_language_code_placeholder()}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <Label>{m.common_title()}</Label>
                            <Input
                              value={tr.title ?? ""}
                              onChange={(e) =>
                                handleTranslationChange(
                                  index,
                                  "title",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 sm:col-span-3">
                            <Label>{m.common_subtitle()}</Label>
                            <Input
                              value={tr.subtitle ?? ""}
                              onChange={(e) =>
                                handleTranslationChange(
                                  index,
                                  "subtitle",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 sm:col-span-3">
                            <Label>{m.common_summary()}</Label>
                            <textarea
                              rows={2}
                              value={tr.summary ?? ""}
                              onChange={(e) =>
                                handleTranslationChange(
                                  index,
                                  "summary",
                                  e.target.value,
                                )
                              }
                              className="rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fill"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 sm:col-span-3">
                            <Label>{m.book_description()}</Label>
                            <textarea
                              rows={4}
                              value={tr.description ?? ""}
                              onChange={(e) =>
                                handleTranslationChange(
                                  index,
                                  "description",
                                  e.target.value,
                                )
                              }
                              className="rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fill"
                            />
                          </div>
                        </div>
                      </div>
                    ),
                  )
                )}
              </section>

              <div>
                <Button
                  type="submit"
                  disabled={
                    updateMutation.isPending ||
                    (slugInput.trim() !== (entityQuery.data?.slug ?? "") &&
                      slugInput.trim() !== "" &&
                      !canSubmitSlug)
                  }
                >
                  <SaveIcon className="size-4" />
                  {updateMutation.isPending
                    ? m.common_saving()
                    : m.common_save()}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </Page>
  );
}
