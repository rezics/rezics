import { Checkbox } from "@rezics/ui/shadcn";
import { PostKind } from "@rezics/contract";
import type React from "react";

const POST_KIND_OPTIONS = Object.values(PostKind);

export type PostKindCheckboxesProps = {
  value: PostKind[];
  onChange: (kinds: PostKind[]) => void;
  label?: string;
};

export const PostKindCheckboxes: React.FC<PostKindCheckboxesProps> = ({
  value,
  onChange,
  label,
}) => {
  const toggle = (kind: PostKind, checked: boolean) => {
    if (checked) {
      if (value.includes(kind)) return;
      onChange([...value, kind]);
    } else {
      onChange(value.filter((k) => k !== kind));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-sm font-medium opacity-60">{label}</span>
      )}
      <div className="flex flex-wrap gap-1">
        {POST_KIND_OPTIONS.map((kind) => (
          <label
            key={kind}
            className="m-0 inline-flex items-center gap-2 cursor-pointer"
          >
            <Checkbox
              checked={value.includes(kind)}
              onCheckedChange={(checked) => toggle(kind, checked === true)}
            />
            <span className="text-sm">{kind}</span>
          </label>
        ))}
      </div>
    </div>
  );
};
