import { PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Checkbox } from "@rezics/ui/shadcn";
import type React from "react";

const POST_KIND_OPTIONS = Object.values(PostKind);

const POST_KIND_I18N_KEYS: Record<PostKind, string> = {
  [PostKind.REVIEW]: "post_kind_review",
  [PostKind.REMARK]: "post_kind_remark",
  [PostKind.EXCERPT]: "post_kind_excerpt",
  [PostKind.POST]: "post_kind_post",
  [PostKind.CHAPTER]: "post_kind_chapter",
  [PostKind.WIKI]: "post_kind_wiki",
};

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
  const { t } = useTranslation("search");

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
      {label && <span className="text-sm font-medium opacity-60">{label}</span>}
      <div className="flex flex-wrap gap-1">
        {POST_KIND_OPTIONS.map((kind) => (
          <div key={kind} className="m-0 inline-flex items-center gap-2">
            <Checkbox
              checked={value.includes(kind)}
              onCheckedChange={(checked) => toggle(kind, checked === true)}
              aria-label={t(POST_KIND_I18N_KEYS[kind])}
            />
            <span className="text-sm">{t(POST_KIND_I18N_KEYS[kind])}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
