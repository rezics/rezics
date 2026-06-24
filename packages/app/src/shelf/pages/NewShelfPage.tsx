import { useCreateShelfMutation } from "@rezics/contract/api/shelf/shelf.mutations";
import { DEFAULT_LANGUAGE, markdownContentDoc } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PolicyDenialNotice, policyDenialFromError } from "@/policy";
import { useRequireAuth } from "@/user/pages/useAuth";
import { SeedTagChipGroup } from "../components/SeedTagChipGroup";

/**
 * New shelf creation page.
 *
 * Form to create a new shelf with title, description, cover URL, and
 * optional seed tags for categorizing shelf content type. Navigates
 * to the new shelf on success.
 *
 * 新建书架页面。创建书架的表单，包括标题、描述、封面 URL 和
 * 可选的分类标签。成功后导航到新创建的书架。
 *
 * Desktop (1200px):
 * +----------------------------------------------+
 * | Create New Shelf                             |
 * +----------------------------------------------+
 * | Title *                                      |
 * | [_________________________________]          |
 * |                                              |
 * | Description                                  |
 * | [_________________________________]          |
 * | [_________________________________]          |
 * | [_________________________________]          |
 * |                                              |
 * | Cover Image URL                              |
 * | [_________________________________]          |
 * |                                              |
 * | Content Type                                 |
 * | [Fiction] [Non-fiction] [Other]              |
 * |                                              |
 * | [Create Shelf]                               |
 * +----------------------------------------------+
 *
 * Tablet (768px):
 * +--------------------------+
 * | Create New Shelf         |
 * +--------------------------+
 * | Title *                  |
 * | [___________________]    |
 * |                          |
 * | Description              |
 * | [___________________]    |
 * | [___________________]    |
 * |                          |
 * | Cover Image URL          |
 * | [___________________]    |
 * |                          |
 * | Content Type             |
 * | [Fiction] [Non-fiction]  |
 * |                          |
 * | [Create Shelf]           |
 * +--------------------------+
 *
 * Mobile (360px):
 * +----------+
 * | New      |
 * | Shelf    |
 * +----------+
 * | Title *  |
 * | [___]    |
 * |          |
 * | Desc     |
 * | [___]    |
 * |          |
 * | Cover    |
 * | [___]    |
 * |          |
 * | Type     |
 * | [Fiction]|
 * |          |
 * | [Create] |
 * +----------+
 */
export function NewShelfPage() {
  useRequireAuth();
  const { t } = useTranslation(["common", "entity"]);
  const navigate = useNavigate();
  const createMutation = useCreateShelfMutation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [pinnedTagIds, setPinnedTagIds] = useState<string[]>([]);

  const handleCreate = () => {
    createMutation.mutate(
      {
        coverUrl: coverUrl || undefined,
        tagIds: pinnedTagIds.length ? pinnedTagIds : undefined,
        translations: [
          {
            language: DEFAULT_LANGUAGE,
            title,
            description: description.trim()
              ? markdownContentDoc(description)
              : null,
          },
        ],
      },
      {
        onSuccess: (data) => {
          navigate({
            to: "/shelf/$shelfId",
            params: { shelfId: data.unitId },
          });
        },
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">
        {t("entity:shelf_new_title")}
      </h1>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-shelf-title">
            {t("entity:shelf_title_label")}
          </Label>
          <Input
            id="new-shelf-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-shelf-description">
            {t("entity:shelf_description_label")}
          </Label>
          <textarea
            id="new-shelf-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-shelf-cover">
            {t("entity:shelf_cover_url_label")}
          </Label>
          <Input
            id="new-shelf-cover"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("entity:shelf_content_type_label")}</Label>
          <SeedTagChipGroup
            value={pinnedTagIds}
            onChange={setPinnedTagIds}
            disabled={createMutation.isPending}
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
