import { useCreatePostMutation } from "@rezics/contract/api/post/post.mutations";
import {
  markdownContentDocWithPoll,
  type PollDTO,
  type PostDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { Link2, Vote, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DraftPublishActions } from "@/draft";
import { policyDenialFromError } from "@/policy";
import { PollComposer, PollLibrarySurface } from "@/poll";
import { isPostEditorSurfaceSubmittable, PostEditorSurface } from "@/post";
import { useAutoDetectedAuthoringLanguageState } from "@/shared/hooks/useAuthoringLanguageDefault";
import { buildRealmPostCreateInput } from "../models/realmCreateMode";
import { RealmPostTagPicker } from "./RealmPostTagPicker";

export interface RealmPostCreateFormProps {
  realmId: string;
  contentRequiresApproval?: boolean;
  detailHref?: string;
  postHref?: (postUnitId: string) => string;
  onCreated?: (post: PostDTO) => void;
}

export function RealmPostCreateForm({
  realmId,
  contentRequiresApproval = false,
  detailHref = `/realm/${realmId}`,
  postHref = (postUnitId) => `/realm/${realmId}/post/${postUnitId}`,
  onCreated,
}: RealmPostCreateFormProps) {
  const { t } = useTranslation(["common"]);
  const { t: tc } = useTranslation(["community"]);
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { defaultLanguage, language, setLanguage } =
    useAutoDetectedAuthoringLanguageState({
      text: `${title}\n${body}`,
    });
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [attachedPoll, setAttachedPoll] = useState<PollDTO | null>(null);
  const createMutation = useCreatePostMutation();
  const denial = policyDenialFromError(createMutation.error);
  const validationMessage = !isPostEditorSurfaceSubmittable({ title, body })
    ? t("common:required")
    : null;
  const disabled = createMutation.isPending || Boolean(validationMessage);

  const handlePollCreated = (poll: PollDTO) => {
    setAttachedPoll(poll);
    setPollDialogOpen(false);
  };

  const handleExistingPollSelected = (pollUnitId: string) => {
    setAttachedPoll({ unitId: pollUnitId } as PollDTO);
    setPollDialogOpen(false);
  };

  const submit = (status: "DRAFT" | "PUBLISHED") => {
    const trimmed = body.trim();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !trimmed) return;
    createMutation.mutate(
      attachedPoll
        ? {
            ...buildRealmPostCreateInput({
              realmId,
              title: trimmedTitle,
              content: trimmed,
              language,
              tagIds: selectedTagIds,
              status,
            }),
            content: markdownContentDocWithPoll(trimmed, attachedPoll.unitId),
          }
        : buildRealmPostCreateInput({
            realmId,
            title: trimmedTitle,
            content: trimmed,
            language,
            tagIds: selectedTagIds,
            status,
          }),
      {
        onSuccess: (post) => {
          onCreated?.(post);
          if (status === "DRAFT") {
            toast.success(t("common:save_draft"));
            return;
          }
          if (contentRequiresApproval) {
            toast.success(tc("community:post_submitted_for_review"));
            navigate({ to: detailHref });
          } else {
            toast.success(tc("community:post_published"));
            navigate({ to: postHref(post.unitId) });
          }
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <PostEditorSurface
        language={language}
        defaultLanguage={defaultLanguage}
        title={title}
        body={body}
        onLanguageChange={setLanguage}
        onTitleChange={setTitle}
        onBodyChange={setBody}
        titlePlaceholder={tc("community:post_title_placeholder")}
        disabled={createMutation.isPending}
      />
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
      {validationMessage ? (
        <p className="m-0 self-end text-xs leading-dense text-error-text">
          {validationMessage}
        </p>
      ) : null}
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
          <Tabs defaultValue="existing">
            <TabsList>
              <TabsTrigger value="existing">
                {tc("community:poll_attach_existing")}
              </TabsTrigger>
              <TabsTrigger value="new">
                {tc("community:poll_attach_create_new")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="existing" className="pt-3">
              <PollLibrarySurface
                renderAction={(poll) => (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleExistingPollSelected(poll.unitId)}
                  >
                    <Link2 className="mr-1 h-4 w-4" />
                    {tc("community:poll_attach_existing_action")}
                  </Button>
                )}
              />
            </TabsContent>
            <TabsContent value="new" className="pt-3">
              <PollComposer
                submitLabel={tc("community:poll_attach_dialog_submit")}
                onCreated={handlePollCreated}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
