import { useCreateRealmMutation } from "@rezics/api/realm/realm";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function NewRealmPage() {
  const navigate = useNavigate();
  const createMutation = useCreateRealmMutation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    createMutation.mutate(
      { translations: [{ language: DEFAULT_LANGUAGE, title, description }] },
      {
        onSuccess: (data) =>
          navigate({ to: "/realm/$realmId", params: { realmId: data.unitId } }),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">New Realm</h1>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-realm-name">Name</Label>
          <Input
            id="new-realm-name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-realm-description">Description</Label>
          <textarea
            id="new-realm-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-rezics-color-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-row justify-end">
          <Button
            onClick={handleCreate}
            disabled={!title || createMutation.isPending}
          >
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NewRealmPage;
