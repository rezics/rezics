import { useCreatePostMutation } from "@rezics/api/post/post";
import type { PollDTO, PostDTO } from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { Link2, Vote, X } from "lucide-react";
import { useMemo, useState } from "react";
import { DraftPublishActions } from "@/draft";
import { PollComposer } from "@/poll";
import { policyDenialFromError } from "@/policy";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
import { buildRealmPostCreateInput } from "../models/realmCreateMode";
import { RealmPostTagPicker } from "./RealmPostTagPicker";

export interface RealmPostCreateFormProps {
  realmId: string;
  onCreated?: (post: PostDTO) => void;
}

export function RealmPostCreateForm({
  realmId,
  onCreated,
}: RealmPostCreateFormProps) {
  const { t } = useTranslation(["common"]);
  const { t: tc } = useTranslation(["community"]);
  const locale = useLocale();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [attachedPoll, setAttachedPoll] = useState<PollDTO | null>(null);
  const resize = useMemo(
    () => ({ height: 260, minHeight: 180, maxHeight: 560 }),
    [],
  );
  const createMutation = useCreatePostMutation();
  const denial = policyDenialFromError(createMutation.error);
  const disabled = createMutation.isPending || !title.trim() || !body.trim();

  const handlePollCreated = (poll: PollDTO) => {
    setAttachedPoll(poll);
    setPollDialogOpen(false);
  };

  const submit = (status: "DRAFT" | "PUBLISHED") => {
    const trimmed = body.trim();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !trimmed) return;
    createMutation.mutate(
      {
        ...buildRealmPostCreateInput({
          realmId,
          title: trimmedTitle,
          content: trimmed,
          language: locale,
          tagIds: selectedTagIds,
          status,
        }),
        ...(attachedPoll
          ? { extra: { poll: { unitId: attachedPoll.unitId } } }
          : {}),
      },
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
    <div className="flex flex-col gap-4">
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={tc("community:post_title_placeholder")}
        disabled={createMutation.isPending}
      />
      <RezicsMarkdownEditor value={body} onChange={setBody} resize={resize} />
      <RealmPostTagPicker
        realmUnitIds={[realmId]}
        selectedTagIds={selectedTagIds}
        onSelectedTagIdsChange={setSelectedTagIds}
      />
      <div className="flex flex-col gap-2 rounded-md bg-surface-subtle p-4">
        {attachedPoll ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <Link2 className="h-4 w-4 shrink-0 text-text-secondary" />
              <div className="min-w-0">
                <p className="m-0 text-sm font-medium leading-ui text-text-primary">
                  {tc("community:poll_attached_title")}
                </p>
                <p className="m-0 truncate text-xs leading-dense text-text-secondary">
                  {attachedPoll.unitId}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAttachedPoll(null)}
              disabled={createMutation.isPending}
            >
              <X className="mr-1 h-4 w-4" />
              {t("common:remove")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-sm leading-ui text-text-secondary">
              {tc("community:poll_attach_post_hint")}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPollDialogOpen(true)}
              disabled={createMutation.isPending}
            >
              <Vote className="mr-1 h-4 w-4" />
              {tc("community:poll_attach")}
            </Button>
          </div>
        )}
      </div>
      <DraftPublishActions
        className="items-end"
        onSaveDraft={() => submit("DRAFT")}
        onPublish={() => submit("PUBLISHED")}
        isPending={createMutation.isPending}
        saveDraftDisabled={disabled}
        publishDisabled={disabled}
        denial={denial}
        saveDraftLabel={t("common:save_draft")}
        publishLabel={t("common:publish")}
      />
      <Dialog open={pollDialogOpen} onOpenChange={setPollDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {tc("community:poll_attach_dialog_title")}
            </DialogTitle>
            <DialogDescription>
              {tc("community:poll_attach_dialog_description")}
            </DialogDescription>
          </DialogHeader>
          <PollComposer
            submitLabel={tc("community:poll_attach_dialog_submit")}
            onCreated={handlePollCreated}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
