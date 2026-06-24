import { Badge } from "@rezics/ui/shadcn";
import type React from "react";

export type TagGroupSuggestionsProps = {
  groups: Record<string, string[]>;
  onAddTag: (slug: string) => void;
};

export const TagGroupSuggestions: React.FC<TagGroupSuggestionsProps> = ({
  groups,
  onAddTag,
}) => {
  const entries = Object.entries(groups).filter(([, tags]) => tags.length > 0);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {entries.map(([key, tags]) => (
        <div key={key} className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium opacity-60">{key}</span>
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge
                key={tag}
                role="button"
                tabIndex={0}
                variant="outline"
                className="cursor-pointer"
                onClick={() => onAddTag(tag)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onAddTag(tag);
                  }
                }}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
