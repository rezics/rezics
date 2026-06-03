import { pollDetailQuery } from "@rezics/api/poll/poll.queries";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import type React from "react";
import { Link } from "@/shared/ui/link";
import { PollView } from "../components/PollView";

interface PollEmbedProps {
  pollUnitId: string;
  realmUnitId?: string | null;
}

/**
 * In-thread embed: fetches the referenced poll by `pollUnitId` and renders the
 * shared `PollView`, with a deep-link to the poll's standalone page. Each embed
 * issues its own `pollDetailQuery`; React Query dedupes by key.
 */
export const PollEmbed: React.FC<PollEmbedProps> = ({
  pollUnitId,
  realmUnitId,
}) => {
  const { t } = useTranslation(["common", "community"]);
  const {
    data: results,
    isLoading,
    error,
  } = useQuery(pollDetailQuery(pollUnitId));

  if (isLoading || error || !results) return null;

  return (
    <fieldset
      className="mt-2 flex flex-col gap-3 rounded-md border border-border-whisper bg-surface-subtle p-4"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <PollView results={results} realmUnitId={realmUnitId} />
      <Link
        to="/poll/$unitId"
        params={{ unitId: pollUnitId }}
        className="inline-flex items-center gap-1 self-start text-xs leading-dense text-text-secondary hover:text-text-primary"
      >
        {t("community:poll_embed_open")}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </fieldset>
  );
};
