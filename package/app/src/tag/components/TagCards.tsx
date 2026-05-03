import { Card, CardContent, Chip, Typography } from "@mui/material";
import type { UnitTagDTO } from "@rezics/contract";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import type React from "react";

export const TagCard: React.FC<{
  tag: UnitTagDTO;
  label?: string;
  onClick?: (tag: UnitTagDTO) => void;
  selected?: boolean;
}> = ({ tag, label: labelProp, onClick, selected }) => {
  const label = labelProp ?? tag.tagUnitId;
  return (
    // biome-ignore lint/a11y/useSemanticElements: interactive card wrapper
    <div
      className={
        "cursor-pointer transition border rounded-md p-3 flex flex-col gap-1 hover:shadow-sm " +
        (selected ? "border-blue-500 shadow" : "border-gray-200")
      }
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(tag)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(tag);
        }
      }}
      data-tag-id={tag.tagUnitId}
    >
      <div className="flex items-center gap-2">
        <Chip
          size="small"
          label={label}
          color={selected ? "primary" : "default"}
        />
        <span className="text-xs text-gray-500 font-mono">
          score: {tag.score}
        </span>
      </div>
      {tag.voteCount > 0 && (
        <div className="text-[10px] text-gray-500 mt-1">
          {tag.voteCount} votes
        </div>
      )}
    </div>
  );
};

export const TagDetailCard: React.FC<{
  tag: UnitTagDTO;
  label?: string;
  onNavigate?: (tag: UnitTagDTO) => void;
}> = ({ tag, label: labelProp }) => {
  const label = labelProp ?? tag.tagUnitId;
  return (
    <Card elevation={0} className="border border-gray-200 rounded-md">
      <CardContent className="space-y-2">
        <Typography variant="h6" component="div">
          {label}
          <span className="ml-2 text-xs font-normal text-gray-500 align-middle">
            score: {tag.score} | {tag.voteCount} votes
          </span>
        </Typography>
        <div>
          <MUILink
            to={"/tag/$unitId"}
            params={{ unitId: tag.tagUnitId }}
            className="text-sm text-blue-600 hover:underline"
          >
            查看详情 →
          </MUILink>
          <MUILink
            to={"/book"}
            search={{ tags: label }}
            className="text-sm text-blue-600 hover:underline !ml-12"
          >
            搜索标签 →
          </MUILink>
        </div>
      </CardContent>
    </Card>
  );
};

export default TagCard;
