import { RezicsJsonEditor } from "@rezics/ui/editor";
import { Button } from "@rezics/ui/shadcn";
import {
  Plus as Add,
  Trash2 as Delete,
  ExternalLink as OpenInNew,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import * as m from "@rezics/i18n/messages";

/** Book extra data structure. */
export type BookExtraData = {
  publishURL?: string[];
  [key: string]: unknown;
};

/** Props for BookExtraEditor component. */
interface BookExtraEditorProps {
  /** Current extra data value. */
  value?: BookExtraData | null;
  /** Callback when extra data changes. */
  onChange?: (value: BookExtraData) => void;
}

function PublishURL({ value, onChange }: BookExtraEditorProps) {
  const [newUrl, setNewUrl] = useState("");
  const urls: string[] = Array.isArray(value) ? value : [];

  const handleAdd = () => {
    if (newUrl.trim() && onChange) {
      const updatedUrls = [...urls, newUrl.trim()];
      onChange({ ...value, publishURL: updatedUrls });
      setNewUrl("");
    }
  };

  const handleRemove = (index: number) => {
    if (onChange) {
      const updatedUrls = urls.filter((_, i) => i !== index);
      onChange({ ...value, publishURL: updatedUrls });
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">
        {m.book_extra_publish_urls_title()}
      </h4>

      {urls.length > 0 && (
        <div className="space-y-2">
          {urls.map((url, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              key={index}
              className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2"
            >
              <OpenInNew
                size={14}
                className="flex-shrink-0 text-muted-foreground"
              />
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-sm text-primary hover:underline"
              >
                {url}
              </a>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleRemove(index)}
                className="w-7 h-7 text-error-text hover:text-error-text"
              >
                <Delete size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={m.placeholders_enter_url()}
          className="flex-1 border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!newUrl.trim()}
        >
          <Add className="w-4 h-4 mr-2" />
          {m.common_add()}
        </Button>
      </div>
    </div>
  );
}

/**
 * Book Extra Editor - Editor for book extra metadata.
 */
export const BookExtraEditor: React.FC<BookExtraEditorProps> = ({
  value,
  onChange,
}) => {
  const [extraData, setExtraData] = useState<BookExtraData>(value || {});

  useEffect(() => {
    setExtraData(value || {});
  }, [value]);

  const handleExtraChange = (newExtraData: BookExtraData) => {
    setExtraData(newExtraData);
    onChange?.(newExtraData);
  };

  return (
    <div className="space-y-4">
      <PublishURL value={extraData || undefined} onChange={handleExtraChange} />
      <div className="h-px bg-border-whisper" />
      <RezicsJsonEditor
        value={JSON.stringify(extraData, null, 2)}
        onChange={(text) => {
          try {
            handleExtraChange(JSON.parse(text));
          } catch {
            // Invalid JSON — ignore until user fixes it
          }
        }}
      />
    </div>
  );
};
