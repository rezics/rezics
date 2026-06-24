import { useImageUpload } from "@rezics/contract/api/upload/upload.mutations";
import { Camera, Trash2, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Alert, AlertDescription, Button, Label } from "@rezics/ui/shadcn";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.gif";

/**
 * +---------------------------------------------+
 * | [Label]                                      |
 * | +--------+  +-----------------------------+  |
 * | |        |  | Drop / paste / click to     |  |
 * | | thumb  |  | upload                      |  |
 * | |  72x72 |  |           [Clear]           |  |
 * | +--------+  +-----------------------------+  |
 * +---------------------------------------------+
 *
 * 可复用的图片上传表单字段。将 `useImageUpload()` 封装为
 * 拖拽/粘贴/点击上传交互，附带缩略图预览与清除按钮。
 */
export function ImageUploadField({
  value,
  onChange,
  label,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  label?: string;
}) {
  const { t } = useTranslation();
  const upload = useImageUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) return;
      try {
        const imageCompression = await import(
          "browser-image-compression" as string
        );
        const compressed = await imageCompression.default(file, {
          maxSizeMB: 4.5,
          maxWidthOrHeight: 4096,
          useWebWorker: true,
        });
        const result = await upload.mutateAsync(compressed);
        onChange(result.url);
      } catch {
        // upload.error covers display 上传错误由 upload.error 覆盖展示
      }
    },
    [onChange, upload],
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
      for (const item of e.clipboardData.items) {
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
    <div className="flex flex-col gap-1.5" onPaste={handlePaste}>
      {label && <Label>{label}</Label>}

      <div className="flex items-start gap-3">
        {value && (
          <img
            src={value}
            alt=""
            className="size-[72px] shrink-0 rounded-md object-cover"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <button
            type="button"
            className={[
              "flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-sm cursor-pointer",
              "transition-colors duration-150",
              dragActive
                ? "border-brand bg-surface-subtle"
                : "border-border-whisper hover:border-fg-secondary",
            ].join(" ")}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? (
              <Spinner size="sm" />
            ) : (
              <>
                {value ? (
                  <Upload className="size-4 text-fg-muted" />
                ) : (
                  <Camera className="size-4 text-fg-muted" />
                )}
                <span className="text-fg-muted">
                  {t("common:upload_image")}
                </span>
              </>
            )}
          </button>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={handleFileChange}
          />

          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => onChange(null)}
            >
              <Trash2 className="mr-1 size-3.5" />
              {t("common:clear")}
            </Button>
          )}
        </div>
      </div>

      {upload.error && (
        <Alert variant="destructive">
          <AlertDescription>{upload.error.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
