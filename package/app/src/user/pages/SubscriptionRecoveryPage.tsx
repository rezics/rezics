import {
  mySubscriptionListEntriesQuery,
  useRecoverSubscriptionListEntryMutation,
} from "@rezics/api/subscription/subscription";
import type { UserSubscriptionListEntryDTO } from "@rezics/contract";
import { EmptyState, Spinner } from "@rezics/ui";
import { Alert, AlertDescription, Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { QueryErrorDisplay } from "@/core";
import { TextLink } from "@/shared/ui/link";
import {
  groupRecoveryEntries,
  subscriptionRecoveryTargetHref,
} from "../models/subscriptionRecovery";
import { useRequireAuth } from "./useAuth";

export const SubscriptionRecoveryPage: React.FC = () => {
  useRequireAuth();
  const query = useQuery(mySubscriptionListEntriesQuery({ state: "REMOVED" }));
  const recover = useRecoverSubscriptionListEntryMutation();
  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const grouped = useMemo(
    () => groupRecoveryEntries(query.data?.entries ?? []),
    [query.data?.entries],
  );

  const handleRecover = async (entry: UserSubscriptionListEntryDTO) => {
    setRecoveringId(entry.subscribedUnitId);
    setErrors((current) => {
      const next = { ...current };
      delete next[entry.subscribedUnitId];
      return next;
    });
    try {
      await recover.mutateAsync(entry.subscribedUnitId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "This subscription cannot be restored right now.";
      setErrors((current) => ({
        ...current,
        [entry.subscribedUnitId]: message,
      }));
    } finally {
      setRecoveringId(null);
    }
  };

  if (query.error) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-16">
        <QueryErrorDisplay error={query.error as Error} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold leading-ui text-text-primary">
          Subscription recovery
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
          Restore removed zones, realms, and other subscriptions when the target
          still exists and is available to your account.
        </p>
      </header>

      {query.isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-text-secondary">
          <Spinner size="sm" />
          Loading removed subscriptions
        </div>
      ) : grouped.official.length === 0 && grouped.other.length === 0 ? (
        <EmptyState
          title="No removed subscriptions"
          description="Subscriptions removed from your sidebar will appear here."
        />
      ) : (
        <div className="flex flex-col gap-10">
          <RecoveryGroup
            title="Official defaults"
            description="These are the Rezics default realm and platform zones created for new accounts."
            entries={grouped.official}
            empty="No official defaults are removed."
            recoveringId={recoveringId}
            errors={errors}
            onRecover={handleRecover}
          />
          <RecoveryGroup
            title="Other subscriptions"
            description="User-added subscriptions can be restored when the target is still visible and subscribable."
            entries={grouped.other}
            empty="No other removed subscriptions."
            recoveringId={recoveringId}
            errors={errors}
            onRecover={handleRecover}
          />
        </div>
      )}
    </div>
  );
};

function RecoveryGroup(props: {
  title: string;
  description: string;
  entries: UserSubscriptionListEntryDTO[];
  empty: string;
  recoveringId: string | null;
  errors: Record<string, string>;
  onRecover: (entry: UserSubscriptionListEntryDTO) => void;
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-base font-semibold leading-ui text-text-primary">
          {props.title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">
          {props.description}
        </p>
      </div>
      {props.entries.length === 0 ? (
        <p className="text-sm text-text-tertiary">{props.empty}</p>
      ) : (
        <ul className="divide-y divide-border-whisper">
          {props.entries.map((entry) => (
            <RecoveryRow
              key={entry.id}
              entry={entry}
              busy={props.recoveringId === entry.subscribedUnitId}
              error={props.errors[entry.subscribedUnitId]}
              onRecover={() => props.onRecover(entry)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RecoveryRow(props: {
  entry: UserSubscriptionListEntryDTO;
  busy: boolean;
  error?: string;
  onRecover: () => void;
}) {
  const href = subscriptionRecoveryTargetHref(props.entry);
  const title =
    props.entry.subscribedTitle ??
    props.entry.subscribedSlug ??
    props.entry.subscribedUnitId;

  return (
    <li className="py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <TextLink
            to={href}
            className="block truncate text-sm font-medium leading-ui text-link hover:underline"
          >
            {title}
          </TextLink>
          <p className="mt-1 text-xs uppercase leading-ui text-text-tertiary">
            {props.entry.subscribedType}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-fit gap-2"
          disabled={props.busy}
          onClick={props.onRecover}
        >
          {props.busy ? (
            <Spinner size="sm" />
          ) : (
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          )}
          Restore
        </Button>
      </div>
      {props.error ? (
        <Alert variant="destructive" className="mt-3" aria-live="assertive">
          <AlertDescription>{props.error}</AlertDescription>
        </Alert>
      ) : null}
    </li>
  );
}
