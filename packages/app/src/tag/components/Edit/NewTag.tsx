import { useAttachTagMutation } from "@rezics/contract/api/tag/tag";
import type { UnitTagDTO } from "@rezics/contract";
import type React from "react";
import { TagEdit } from "./TagEdit";

export type NewTagProps = {
  objectUnitId?: string;
  onCreated?: (tag: UnitTagDTO) => void | Promise<void>;
  className?: string;
};

/**
 * NewTag - creates a new tag and optionally attaches it to a target unit.
 * Now uses UnitTagDTO instead of old TagDetailDTO.
 */
export const NewTag: React.FC<NewTagProps> = ({
  objectUnitId,
  onCreated,
  className,
}) => {
  const attachMutation = useAttachTagMutation();

  const handleSaved = async (tag: UnitTagDTO) => {
    if (objectUnitId) {
      await attachMutation.mutateAsync({
        tagUnitId: tag.tagUnitId,
        unitId: objectUnitId,
      });
    }
    await onCreated?.(tag);
  };

  return <TagEdit onSaved={handleSaved} className={className} />;
};
