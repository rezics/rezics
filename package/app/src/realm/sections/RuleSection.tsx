import { postQueries } from "@rezics/api/post/post";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { RealmRuleDialog } from "./RealmRuleDialog";

export interface RuleSectionProps {
  postUnitId?: string | null;
}

export const RuleSection: React.FC<RuleSectionProps> = ({ postUnitId }) => {
  const [open, setOpen] = useState(false);
  const { data: post, isError } = useQuery({
    ...postQueries.detail(postUnitId ?? ""),
    enabled: Boolean(postUnitId),
  });

  if (!postUnitId || isError) return null;

  const preview = post?.body?.trim().split("\n").find(Boolean) ?? "Realm rules";

  return (
    <section className="rounded-md bg-surface-subtle p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium leading-ui text-text-primary">
            Rules
          </h2>
          <p className="mt-1 line-clamp-2 text-sm leading-body text-text-secondary">
            {preview}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          View
        </Button>
      </div>
      <RealmRuleDialog open={open} post={post} onOpenChange={setOpen} />
    </section>
  );
};
