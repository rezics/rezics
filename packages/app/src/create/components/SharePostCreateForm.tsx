import { useCreatePostMutation } from "@rezics/contract/api/post/post.mutations";
import { useTranslation } from "@rezics/i18n/react";
import { Input } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DraftPublishActions } from "@/draft";
import { buildInternalSharePostCreateInput } from "@/engagement";
import { policyDenialFromError } from "@/policy";
import { useAuthoringLanguageDefault } from "@/shared/hooks/useAuthoringLanguageDefault";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";

export type SharePostCreateFormProps = {
  targetUnitId: string;
  initialTitle?: string;
};

export function SharePostCreateForm({
  targetUnitId,
  initialTitle,
}: SharePostCreateFormProps) {
  const { t } = useTranslation(["common"]);
  const navigate = useNavigate();
  const language = useAuthoringLanguageDefault();
  const [title, setTitle] = useState(
    initialTitle?.trim() || t("common:share_post_default_title"),
  );
  const [body, setBody] = useState("");
  const resize = useMemo(
    () => ({ height: 260, minHeight: 180, maxHeight: 560 }),
    [],
  );
  const createMutation = useCreatePostMutation();
  const denial = policyDenialFromError(createMutation.error);
  const validationMessage = !title.trim() ? t("common:required") : null;
  const disabled = createMutation.isPending || Boolean(validationMessage);

  const submit = (status: "DRAFT" | "PUBLISHED") => {
    if (!title.trim()) return;
    createMutation.mutate(
      buildInternalSharePostCreateInput({
        targetUnitId,
        title,
        body,
        language,
        status,
      }),
      {
        onSuccess: (post) => {
          if (status === "DRAFT") {
            toast.success(t("common:save_draft"));
            return;
          }
          toast.success(t("common:share_post_created"));
          navigate({
            to: "/post/$rootPostUnitId",
            params: { rootPostUnitId: post.unitId },
          });
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("common:share_post_title_placeholder")}
        disabled={createMutation.isPending}
      />
      <div className="flex items-center gap-2 rounded-md bg-surface-subtle p-3 text-sm leading-ui text-text-secondary">
        <Link2 className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">
          {t("common:share_reference_attached", { id: targetUnitId })}
        </span>
      </div>
      <RezicsMarkdownEditor
        value={body}
        onChange={setBody}
        resize={resize}
        placeholder={t("common:share_post_body_placeholder")}
      />
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
    </div>
  );
}
