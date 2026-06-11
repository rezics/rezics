import {
  mySubscriptionListEntriesQuery,
  useRecoverSubscriptionListEntryMutation,
} from "@rezics/api/subscription/subscription";
import type { UserSubscriptionListEntryDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
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
  const { t } = useTranslation("settings");
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
          : t("subscription_recovery_restore_error");
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
          {t("subscription_recovery_title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
          {t("subscription_recovery_description")}
        </p>
      </header>

      {query.isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-text-secondary">
          <Spinner size="sm" />
          {t("subscription_recovery_loading")}
        </div>
      ) : grouped.official.length === 0 && grouped.other.length === 0 ? (
        <EmptyState
          title={t("subscription_recovery_empty_title")}
          description={t("subscription_recovery_empty_description")}
        />
      ) : (
        <div className="flex flex-col gap-10">
          <RecoveryGroup
            title={t("subscription_recovery_official_title")}
            description={t("subscription_recovery_official_description")}
            entries={grouped.official}
            empty={t("subscription_recovery_official_empty")}
            recoveringId={recoveringId}
            errors={errors}
            onRecover={handleRecover}
          />
          <RecoveryGroup
            title={t("subscription_recovery_other_title")}
            description={t("subscription_recovery_other_description")}
            entries={grouped.other}
            empty={t("subscription_recovery_other_empty")}
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
  const { t } = useTranslation("settings");
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
          {t("subscription_recovery_restore")}
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
