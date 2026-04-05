import {useState, useRef, useCallback} from 'react';
import {Button} from '@/shadcn/button';
import {useImageUpload} from '@rezics/api/upload/upload.mutations';
import type {ImageProvider} from './types';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.gif';

interface UploadContentProps {
  onInsert: (url: string, alt?: string) => void;
}

function UploadContent({onInsert}: UploadContentProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useImageUpload();

  const processFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Unsupported file type. Use JPEG, PNG, WebP, or GIF.');
        return;
      }

      setError(null);

      try {
        const imageCompression = await import('browser-image-compression');
        const compressed = await imageCompression.default(file, {
          maxSizeMB: 4.5,
          maxWidthOrHeight: 4096,
          useWebWorker: true,
        });

        const result = await mutation.mutateAsync(compressed);
        onInsert(result.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
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
        if (item.type.startsWith('image/')) {
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
    <div className="flex flex-col gap-3 p-2" onPaste={handlePaste}>
      <div
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {mutation.isPending ? (
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <div className="i-lucide-loader-2 h-8 w-8 animate-spin" />
            <span>Uploading...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <span className="text-2xl">📷</span>
            <span>Drop image here, paste, or click to browse</span>
            <span className="text-xs">JPEG, PNG, WebP, GIF — max 5MB</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={handleFileChange}
      />

      {error && (
        <div className="flex items-center justify-between rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

export const rezicsUploadProvider: ImageProvider = {
  name: 'rezics-upload',
  label: 'Upload',
  icon: <span className="text-xs">📤</span>,
  render: ({onInsert}) => <UploadContent onInsert={onInsert} />,
};
