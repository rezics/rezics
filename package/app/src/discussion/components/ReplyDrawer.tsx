import { useTheme } from "@mui/material/styles";
import { RezicsMarkdownEditor } from "@rezics/ui/editor";
import { useCreatePostMutation } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import type React from "react";
import { useEffect, useRef, useState } from "react";

interface ReplyDrawerProps {
  parentPostUnitId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ReplyDrawer: React.FC<ReplyDrawerProps> = ({
  parentPostUnitId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const theme = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const mutation = useCreatePostMutation();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = () => {
    if (!content.trim()) return;
    mutation.mutate(
      {
        parentPostUnitId,
        kind: PostKind.POST,
        body: content.trim(),
      },
      {
        onSuccess: () => {
          setContent("");
          onClose();
          onSuccess?.();
        },
      },
    );
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${
        isOpen
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
      }`}
      onClick={handleOverlayClick}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        ref={panelRef}
        className={`absolute bottom-0 left-1/2 w-full max-w-4xl -translate-x-1/2 transition-transform duration-200 ease-out ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div
          className="rounded-t-2xl"
          style={{ backgroundColor: theme.palette.background.paper }}
        >
          <RezicsMarkdownEditor
            value={content}
            onChange={setContent}
            onSubmit={handleSubmit}
            submitLabel={mutation.isPending ? "Submitting..." : "Reply"}
          />
        </div>
      </div>
    </div>
  );
};
