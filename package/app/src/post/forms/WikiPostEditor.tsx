import { getLockedFieldError } from "@rezics/api";
import {
  useCreateWikiPostMutation,
  useUpdateWikiPostBodyMutation,
} from "@rezics/api/post/post";
import type { PostDTO } from "@rezics/contract";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
import { Alert, AlertDescription, Button } from "@rezics/ui/shadcn";
import { useMemo, useState } from "react";

export interface WikiPostEditorProps {
  targetUnitId?: string;
  post?: PostDTO;
  onSaved?: (post: PostDTO) => void;
  onCancel?: () => void;
}

export function WikiPostEditor({
  targetUnitId,
  post,
  onSaved,
  onCancel,
}: WikiPostEditorProps) {
  const [body, setBody] = useState(post?.body ?? "");
  const [lockedError, setLockedError] = useState<string | null>(null);
  const resize = useMemo(
    () => ({ height: 220, minHeight: 140, maxHeight: 520 }),
    [],
  );
  const createMutation = useCreateWikiPostMutation({ onSuccess: onSaved });
  const updateMutation = useUpdateWikiPostBodyMutation({
    onSuccess: onSaved,
    onError: (error) => {
      const locked = getLockedFieldError(error);
      if (!locked) return;
      setLockedError(
        locked.blockedFieldKeys.length
          ? `Locked fields: ${locked.blockedFieldKeys.join(", ")}`
          : locked.message,
      );
    },
  });
  const activeMutation = post ? updateMutation : createMutation;

  const handleSave = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setLockedError(null);

    if (post) {
      updateMutation.mutate({ unitId: post.unitId, body: trimmed });
      return;
    }

    createMutation.mutate({ body: trimmed, targetUnitId } as never);
  };

  return (
    <div className="flex flex-col gap-3">
      {lockedError ? (
        <Alert variant="destructive">
          <AlertDescription>{lockedError}</AlertDescription>
        </Alert>
      ) : null}
      <RezicsMarkdownEditor value={body} onChange={setBody} resize={resize} />
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={activeMutation.isPending}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={handleSave}
          disabled={activeMutation.isPending || !body.trim()}
        >
          {activeMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
