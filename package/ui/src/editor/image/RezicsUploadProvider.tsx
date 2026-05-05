import { useImageUpload } from "@rezics/api/upload/upload.mutations";
import {
  Camera as CameraAltIcon,
  CloudUpload as CloudUploadIcon,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/shadcn/alert";
import { Spinner } from "@/primitive/feedback/Spinner";
import type { ImageProvider } from "./types";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.gif";

interface UploadContentProps {
  onInsert: (url: string, alt?: string) => void;
}

function UploadContent({ onInsert }: UploadContentProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useImageUpload();

  const processFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Unsupported file type. Use JPEG, PNG, WebP, or GIF.");
        return;
      }

      setError(null);

      try {
        const imageCompression = await import("browser-image-compression");
        const compressed = await imageCompression.default(file, {
          maxSizeMB: 4.5,
          maxWidthOrHeight: 4096,
          useWebWorker: true,
        });

        const result = await mutation.mutateAsync(compressed);
        onInsert(result.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [mutation, onInsert],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            processFile(file);
            return;
          }
        }
      }
    },
    [processFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  return (
    <div className="flex flex-col gap-3 p-1" onPaste={handlePaste}>
      <button
        type="button"
        className={[
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer",
          "transition-colors duration-200",
          dragActive
            ? "border-brand bg-rezics-surface-subtle"
            : "border-border-whisper hover:border-rezics-fg-secondary",
        ].join(" ")}
        onDragOver={(e: React.DragEvent) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {mutation.isPending ? (
          <div className="flex flex-col items-center gap-2">
            <Spinner size="lg" />
            <p className="text-sm text-rezics-fg-muted">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <CameraAltIcon size={32} color="var(--colors-text-tertiary)" />
            <p className="text-sm text-rezics-fg-muted">
              Drop image here, paste, or click to browse
            </p>
            <p className="text-xs text-rezics-fg-muted">
              JPEG, PNG, WebP, GIF — max 5MB
            </p>
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export const rezicsUploadProvider: ImageProvider = {
  name: "rezics-upload",
  label: "Upload",
  icon: <CloudUploadIcon className="size-4" />,
  render: ({ onInsert }) => <UploadContent onInsert={onInsert} />,
};
