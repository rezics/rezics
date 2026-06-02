import { useCreatePostMutation } from "@rezics/api/post/post";
import type { PollDTO, PostDTO } from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import { Button, Input, ToggleGroup, ToggleGroupItem } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PollComposer } from "@/poll";
import { PolicyDenialNotice, policyDenialFromError } from "@/policy";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
import { buildRealmPollPostCreateInput } from "../models/realmCreateMode";
import { RealmPostTagPicker } from "./RealmPostTagPicker";

export interface RealmPollPostCreateFormProps {
  realmId: string;
  onCreated?: (post: PostDTO) => void;
}

export function RealmPollPostCreateForm({
  realmId,
  onCreated,
}: RealmPollPostCreateFormProps) {
  const { t } = useTranslation(["common", "community"]);
  const locale = useLocale();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("PUBLISHED");
  const resize = useMemo(
    () => ({ height: 180, minHeight: 120, maxHeight: 420 }),
    [],
  );
  const createMutation = useCreatePostMutation();
  const denial = policyDenialFromError(createMutation.error);

  const createPostForPoll = (poll: PollDTO) => {
    const trimmed = body.trim();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !trimmed) return;
    createMutation.mutate(
      buildRealmPollPostCreateInput({
        realmId,
        title: trimmedTitle,
        content: trimmed,
        language: locale,
        tagIds: selectedTagIds,
        pollUnitId: poll.unitId,
        status,
      }),
      {
        onSuccess: (post) => {
          onCreated?.(post);
          if (status === "PUBLISHED") {
            navigate({
              to: "/realm/$realmId/post/$postUnitId",
              params: { realmId, postUnitId: post.unitId },
            });
          }
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("community:post_title_placeholder")}
          disabled={createMutation.isPending}
        />
        <RezicsMarkdownEditor value={body} onChange={setBody} resize={resize} />
        <RealmPostTagPicker
          realmUnitIds={[realmId]}
          selectedTagIds={selectedTagIds}
          onSelectedTagIdsChange={setSelectedTagIds}
        />
        <div className="flex justify-end">
          <ToggleGroup
            type="single"
            value={status}
            onValueChange={(value) => {
              if (value === "DRAFT" || value === "PUBLISHED") setStatus(value);
            }}
          >
            <ToggleGroupItem value="DRAFT">
              {t("common:save_draft")}
            </ToggleGroupItem>
            <ToggleGroupItem value="PUBLISHED">
              {t("common:publish")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <PolicyDenialNotice denial={denial} />
      {createMutation.isError && !denial ? (
        <p className="text-sm leading-ui text-error-text">
          {t("community:poll_attach_error")}
        </p>
      ) : null}
      {title.trim() && body.trim() ? (
        <div className="rounded-md bg-surface-subtle p-4">
          <PollComposer
            submitLabel={
              status === "DRAFT"
                ? t("common:save_draft")
                : t("community:poll_attach_submit")
            }
            onCreated={createPostForPoll}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 rounded-md bg-surface-subtle p-4">
          <p className="text-sm leading-ui text-text-secondary">
            {t("community:post_reply_placeholder")}
          </p>
          <Button type="button" disabled>
            {t("community:poll_attach")}
          </Button>
        </div>
      )}
    </div>
  );
}
