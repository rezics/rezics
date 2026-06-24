import { useCreateRealmMutation } from "@rezics/api/realm/realm";
import { markdownContentDoc } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Button, Input, Label, Textarea } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PolicyDenialNotice, policyDenialFromError } from "@/policy";
import { useAuthoringLanguageDefault } from "@/shared/hooks/useAuthoringLanguageDefault";
import { unitHref } from "@/shared/ui/link";

/**
 * Full-page form for creating a new realm (community).
 * Collects title and description.
 * Navigates to the new realm on successful creation.
 *
 * 用于创建新社区的整页表单。
 * 收集标题和描述。
 * 成功创建后导航到新社区。
 *
 * Layout:
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Create Realm             │
 * ├──────────────────────────┤
 * │ Name                     │
 * │ [Input field]            │
 * │                          │
 * │ Description              │
 * │ [Text area - 4 rows]     │
 * │                          │
 * │ [Policy denial notice]   │
 * │                          │
 * │                 [Create] │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Create Realm                       │
 * ├────────────────────────────────────┤
 * │ Name                               │
 * │ [Input field]                      │
 * │                                    │
 * │ Description                        │
 * │ [Text area - 4 rows]               │
 * │                                    │
 * │ [Policy denial notice]             │
 * │                              [Create]
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌──────────────────────────────────────┐
 * │ Create Realm                         │
 * ├──────────────────────────────────────┤
 * │ Name                                 │
 * │ [Input field]                        │
 * │                                      │
 * │ Description                          │
 * │ [Text area - 4 rows]                 │
 * │                                      │
 * │ [Policy denial notice]               │
 * │                                 [Create]
 * └──────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * Same as Desktop - max-width 3xl container centered
 */
export function NewRealmPage() {
  const { t } = useTranslation(["common", "community", "entity"]);
  const authoringLanguage = useAuthoringLanguageDefault();
  const navigate = useNavigate();
  const createMutation = useCreateRealmMutation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    createMutation.mutate(
      {
        translations: [
          {
            language: authoringLanguage,
            title,
            description: description.trim()
              ? markdownContentDoc(description)
              : null,
          },
        ],
      },
      {
        onSuccess: (data) =>
          navigate({
            to: unitHref({
              type: "REALM",
              unitId: data.unitId,
              slug: data.slug ?? null,
            }),
          }),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">
        {t("entity:realm_new_title")}
      </h1>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-realm-name">{t("common:name")}</Label>
          <Input
            id="new-realm-name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-realm-description">
            {t("common:description")}
          </Label>
          <Textarea
            id="new-realm-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>
        <PolicyDenialNotice
          denial={policyDenialFromError(createMutation.error)}
        />
        <div className="flex flex-row justify-end">
          <Button
            onClick={handleCreate}
            disabled={!title || createMutation.isPending}
          >
            {t("common:create")}
          </Button>
        </div>
      </div>
    </div>
  );
}
