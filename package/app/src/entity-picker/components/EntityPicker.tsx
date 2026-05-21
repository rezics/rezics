import { useEntitySearch } from "@rezics/api/entity";
import type { EntityKind } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "@rezics/ui/shadcn";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { EntityInlineCreateForm } from "./EntityInlineCreateForm";
import { EntityResultRow } from "./EntityResultRow";

export interface EntityPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Invoked with the selected entity's unitId (existing or just-created). */
  onSelect: (unitId: string) => void;
  /** Catalog creates wiki entities; personal creates current-user entities. */
  creationContext?: "catalog" | "personal";
  /** Optional current USER unitId for personal-context owner bias. */
  ownerUnitId?: string;
  /** Soft kind hints for ranking and inline-create defaults. */
  kindHints?: readonly EntityKind[];
  kindHint?: EntityKind;
}

export function EntityPicker({
  open,
  onOpenChange,
  onSelect,
  creationContext = "catalog",
  ownerUnitId,
  kindHints,
  kindHint,
}: EntityPickerProps) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim(), 200);

  const effectiveKindHints = useMemo(
    () => kindHints ?? (kindHint ? [kindHint] : []),
    [kindHint, kindHints],
  );

  const searchQuery = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      limit: 12,
    }),
    [debouncedQuery],
  );

  const { data, isFetching } = useEntitySearch(searchQuery);
  const results = data?.entities ?? [];

  // When the kindHint is provided we soft-sort matches of that kind first,
  // emulating a Meili `filter` weight without dropping other matches.
  const orderedResults = useMemo(() => {
    if (effectiveKindHints.length === 0 && !ownerUnitId) return results;
    return [...results].sort((a, b) => {
      const ao =
        creationContext === "personal" && a.ownerUnitId === ownerUnitId ? 0 : 1;
      const bo =
        creationContext === "personal" && b.ownerUnitId === ownerUnitId ? 0 : 1;
      if (ao !== bo) return ao - bo;
      const am = a.kind && effectiveKindHints.includes(a.kind) ? 0 : 1;
      const bm = b.kind && effectiveKindHints.includes(b.kind) ? 0 : 1;
      return am - bm;
    });
  }, [creationContext, effectiveKindHints, ownerUnitId, results]);

  const handleSelect = (unitId: string) => {
    onSelect(unitId);
    reset();
    onOpenChange(false);
  };

  const reset = () => {
    setQuery("");
    setCreating(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-xl gap-0 p-0">
        <DialogHeader className="border-b border-border-whisper p-4">
          <DialogTitle>Find or create entity</DialogTitle>
          <DialogDescription>
            Search for an existing entity, or create a new one inline.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entities…"
            autoFocus
          />
        </div>

        <div className="max-h-64 overflow-y-auto px-3 pb-2">
          {isFetching && debouncedQuery ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : null}

          {!isFetching && debouncedQuery && orderedResults.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-text-secondary">
              No matching entities — create one?
            </p>
          ) : null}

          {orderedResults.map((entity) => (
            <EntityResultRow
              key={entity.unitId}
              entity={entity}
              onSelect={handleSelect}
            />
          ))}
        </div>

        <div className="sticky bottom-0 border-t border-border-whisper bg-surface-canvas p-3">
          {creating ? null : (
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setCreating(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create new entity
              {query.trim() ? `: “${query.trim()}”` : ""}
            </Button>
          )}
        </div>

        {creating ? (
          <EntityInlineCreateForm
            initialTitle={query.trim()}
            creationContext={creationContext}
            kindHint={effectiveKindHints[0]}
            onCreated={handleSelect}
            onCancel={() => setCreating(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
