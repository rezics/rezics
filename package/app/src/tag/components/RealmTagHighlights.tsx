import { Badge } from "@rezics/ui/shadcn";
import type React from "react";
import { useState } from "react";

interface RealmHighlight {
  realmUnitId: string;
  realmName: string;
  tags: string[];
}

interface RealmTagHighlightsProps {
  realmHighlights: RealmHighlight[];
}

export const RealmTagHighlights: React.FC<RealmTagHighlightsProps> = ({
  realmHighlights,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (realmHighlights.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        className="text-xs text-text-secondary cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        Realm highlights ({realmHighlights.length})
      </button>
      <div
        className={
          expanded
            ? "grid grid-rows-[1fr] transition-[grid-template-rows] duration-200"
            : "grid grid-rows-[0fr] transition-[grid-template-rows] duration-200"
        }
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-2 mt-2">
            {realmHighlights.map((rh) => (
              <div key={rh.realmUnitId}>
                <p className="text-xs font-semibold">{rh.realmName}</p>
                <div className="flex flex-row flex-wrap gap-1 mt-1">
                  {rh.tags.map((tagId) => (
                    <Badge key={tagId} variant="outline">
                      {tagId}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
