import { useCreateRealmMutation } from "@rezics/api/realm/realm";
import { DEFAULT_LANGUAGE, markdownContentDoc } from "@rezics/contract";
import { unitHref } from "@/shared/ui/link";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import * as m from "@rezics/i18n/messages";

export function NewRealmPage() {
  const navigate = useNavigate();
  const createMutation = useCreateRealmMutation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    createMutation.mutate(
      {
        translations: [
          {
            language: DEFAULT_LANGUAGE,
            title,
            description: description.trim()
              ? markdownContentDoc(description)
              : null,
          },
        ],
      },
      {
        onSuccess: (data) =>
          navigate({
            to: unitHref({
              type: "REALM",
              unitId: data.unitId,
              slug: data.slug ?? null,
            }),
          }),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">{m.realm_new_title()}</h1>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-realm-name">{m.common_name()}</Label>
          <Input
            id="new-realm-name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-realm-description">
            {m.common_description()}
          </Label>
          <textarea
            id="new-realm-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-row justify-end">
          <Button
            onClick={handleCreate}
            disabled={!title || createMutation.isPending}
          >
            {m.common_create()}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NewRealmPage;
