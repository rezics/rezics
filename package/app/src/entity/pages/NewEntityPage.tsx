import { useCreateEntity } from "@rezics/api/entity";
import type { CreateEntityInput, EntityKind } from "@rezics/contract";
import { CreationMode, entityKinds } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import {
  suggestCreditEligibility,
  suggestSubjectEligibility,
} from "@/entity-picker";
import { unitHref } from "@/shared/ui/link";

export function NewEntityPage() {
  const { t } = useTranslation(["common", "entity", "shell"]);
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("en");
  const [kind, setKind] = useState<EntityKind>(entityKinds[0]);
  const [avatar, setAvatar] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateEntity({
    onSuccess: (entity) => {
      void navigate({
        to: unitHref({
          type: "ENTITY",
          unitId: entity.unitId,
          slug: entity.slug ?? null,
        }),
      });
    },
    onError: (err) => setError(err.message || t("entity:create_failed")),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError(t("entity:title_required"));
      return;
    }
    const payload: CreateEntityInput = {
      kind,
      avatar: avatar.trim() || null,
      eligibleCreditRoles: suggestCreditEligibility(kind),
      eligibleSubjectRoles: suggestSubjectEligibility(kind),
      creationMode: CreationMode.PERSONAL,
      translations: [{ language: language.trim() || "en", title: trimmed }],
    };
    mutation.mutate(payload);
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        {t("entity:new_title")}
      </h1>
      <p className="mb-6 text-sm text-text-secondary">
        {t("entity:new_description")}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entity-title">{t("entity:title_label")}</Label>
          <Input
            id="entity-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("entity:title_placeholder")}
            required
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entity-language">{t("common:language")}</Label>
            <Input
              id="entity-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder={t("shell:language_code_placeholder")}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entity-kind">{t("entity:kind_label")}</Label>
            <select
              id="entity-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as EntityKind)}
              className="h-9 rounded-md border border-border-whisper bg-surface-canvas px-2 text-sm text-text-primary"
            >
              {entityKinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entity-avatar">{t("entity:avatar_url")}</Label>
          <Input
            id="entity-avatar"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder={t("entity:avatar_person_placeholder")}
          />
        </div>

        {error ? <p className="text-sm text-text-error">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => void navigate({ to: "/user/me/entity" })}
          >
            {t("common:cancel")}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t("common:creating") : t("entity:create")}
          </Button>
        </div>
      </form>
    </div>
  );
}
