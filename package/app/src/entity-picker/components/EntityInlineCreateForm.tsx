import { useCreateEntity } from "@rezics/api/entity";
import type { CreateEntityInput, EntityKind } from "@rezics/contract";
import { CreationMode, entityKinds } from "@rezics/contract";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { type FormEvent, useState } from "react";

interface EntityInlineCreateFormProps {
  initialTitle?: string;
  initialLanguage?: string;
  kindHint?: EntityKind | string;
  onCreated: (unitId: string) => void;
  onCancel?: () => void;
}

export function EntityInlineCreateForm({
  initialTitle = "",
  initialLanguage = "en",
  kindHint,
  onCreated,
  onCancel,
}: EntityInlineCreateFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [language, setLanguage] = useState(initialLanguage);
  const [kind, setKind] = useState<string>(kindHint ?? entityKinds[0]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateEntity({
    onSuccess: (entity) => onCreated(entity.unitId),
    onError: (err) => setError(err.message || "Failed to create entity"),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required");
      return;
    }
    const trimmedLang = language.trim() || "en";
    const payload: CreateEntityInput = {
      kind,
      creationMode: CreationMode.WIKI,
      translations: [{ language: trimmedLang, title: trimmedTitle }],
    };
    mutation.mutate(payload);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 border-t border-border-whisper p-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="entity-inline-title">Title</Label>
        <Input
          id="entity-inline-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Liu Cixin"
          autoFocus
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entity-inline-language">Language</Label>
          <Input
            id="entity-inline-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="en"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entity-inline-kind">Kind</Label>
          <select
            id="entity-inline-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="h-9 rounded-md border border-border-whisper bg-surface-canvas px-2 text-sm text-text-primary"
          >
            {entityKinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error ? <p className="text-xs text-text-error">{error}</p> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating…" : "Create"}
        </Button>
      </div>
    </form>
  );
}
