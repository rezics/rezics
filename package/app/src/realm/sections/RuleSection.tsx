import { postQueries } from "@rezics/api/post/post";
import { mainMarkdownSource } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
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

  const preview =
    mainMarkdownSource(post?.content)?.trim().split("\n").find(Boolean) ??
    m.realm_rules_title();

  return (
    <section className="rounded-md bg-surface-subtle p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium leading-ui text-text-primary">
            {m.realm_rules_title()}
          </h2>
          <p className="mt-1 line-clamp-2 text-sm leading-body text-text-secondary">
            {preview}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {m.common_view()}
        </Button>
      </div>
      <RealmRuleDialog open={open} post={post} onOpenChange={setOpen} />
    </section>
  );
};
