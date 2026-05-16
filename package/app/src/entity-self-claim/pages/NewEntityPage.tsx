import { useCreateEntity } from "@rezics/api/entity";
import type { CreateEntityInput } from "@rezics/contract";
import { entityKinds } from "@rezics/contract";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

export function NewEntityPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("en");
  const [kind, setKind] = useState<string>(entityKinds[0]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateEntity({
    onSuccess: (entity) => {
      void navigate({
        to: "/entity/$unitId",
        params: { unitId: entity.unitId },
      });
    },
    onError: (err) => setError(err.message || "Failed to create entity"),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required");
      return;
    }
    const payload: CreateEntityInput = {
      kind,
      translations: [{ language: language.trim() || "en", title: trimmed }],
    };
    mutation.mutate(payload);
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        Declare a new entity
      </h1>
      <p className="mb-6 text-sm text-text-secondary">
        Create an entity that you own — for example, your pen name or a project
        you run. You can add translations and more details later.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entity-title">Title</Label>
          <Input
            id="entity-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Liu Cixin"
            required
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entity-language">Language</Label>
            <Input
              id="entity-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="en"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entity-kind">Kind</Label>
            <select
              id="entity-kind"
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

        {error ? <p className="text-sm text-text-error">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => void navigate({ to: "/user/me/entities" })}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create entity"}
          </Button>
        </div>
      </form>
    </div>
  );
}
