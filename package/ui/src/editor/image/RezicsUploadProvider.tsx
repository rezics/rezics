import CameraAltIcon from "@mui/icons-material/CameraAlt";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useImageUpload } from "@rezics/api/upload/upload.mutations";
import { useCallback, useRef, useState } from "react";
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
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1 }}
      onPaste={handlePaste}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 2,
          border: 2,
          borderStyle: "dashed",
          borderColor: dragActive ? "primary.main" : "divider",
          bgcolor: dragActive ? "action.hover" : "transparent",
          p: 4,
          cursor: "pointer",
          transition: "border-color 0.2s, background-color 0.2s",
          "&:hover": {
            borderColor: "text.secondary",
          },
        }}
        onDragOver={(e: React.DragEvent) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {mutation.isPending ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
            }}
          >
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">
              Uploading...
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
            }}
          >
            <CameraAltIcon sx={{ fontSize: 32 }} color="action" />
            <Typography variant="body2" color="text.secondary">
              Drop image here, paste, or click to browse
            </Typography>
            <Typography variant="caption" color="text.secondary">
              JPEG, PNG, WebP, GIF — max 5MB
            </Typography>
          </Box>
        )}
      </Box>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Box>
  );
}

export const rezicsUploadProvider: ImageProvider = {
  name: "rezics-upload",
  label: "Upload",
  icon: <CloudUploadIcon fontSize="small" />,
  render: ({ onInsert }) => <UploadContent onInsert={onInsert} />,
};
