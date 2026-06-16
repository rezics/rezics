import { useCreateRealmMutation } from "@rezics/api/realm/realm";
import { markdownContentDoc, type RealmTagViewStyle } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PolicyDenialNotice, policyDenialFromError } from "@/policy";
import { useAuthoringLanguageDefault } from "@/shared/hooks/useAuthoringLanguageDefault";
import { unitHref } from "@/shared/ui/link";

/**
 * Full-page form for creating a new realm (community).
 * Collects title, description, tag view style preference, and viewer switch setting.
 * Navigates to the new realm on successful creation.
 *
 * 用于创建新社区的整页表单。
 * 收集标题、描述、标签视图样式偏好和查看者切换设置。
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
 * │ Tag View                 │
 * │ [Dropdown]               │
 * │ [Toggle Viewer Switch]   │
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
 * │ Tag View                           │
 * │ [Dropdown]         [Toggle]        │
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
 * │ Tag View                             │
 * │ [Dropdown]                [Toggle]   │
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
  const [tagViewStyle, setTagViewStyle] = useState<RealmTagViewStyle>("flat");
  const [allowTagViewSwitch, setAllowTagViewSwitch] = useState(true);

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
        extra: {
          tagView: {
            defaultStyle: tagViewStyle,
            allowViewerSwitch: allowTagViewSwitch,
          },
        },
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
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold leading-ui text-text-primary">
              {t("community:tag_view_heading")}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-realm-tag-view-style">
                {t("community:tag_view_default")}
              </Label>
              <Select
                value={tagViewStyle}
                onValueChange={(value) =>
                  setTagViewStyle(value as RealmTagViewStyle)
                }
              >
                <SelectTrigger id="new-realm-tag-view-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">
                    {t("community:tag_view_flat")}
                  </SelectItem>
                  <SelectItem value="grouped">
                    {t("community:tag_view_grouped")}
                  </SelectItem>
                  <SelectItem value="tree">
                    {t("community:tag_view_tree")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant={allowTagViewSwitch ? "secondary" : "outline"}
              onClick={() => setAllowTagViewSwitch((value) => !value)}
            >
              {allowTagViewSwitch
                ? t("community:tag_view_viewer_switch_on")
                : t("community:tag_view_viewer_switch_off")}
            </Button>
          </div>
        </section>
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
