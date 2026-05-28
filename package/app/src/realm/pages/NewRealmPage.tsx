import { useCreateRealmMutation } from "@rezics/api/realm/realm";
import {
  DEFAULT_LANGUAGE,
  markdownContentDoc,
  type RealmTagViewStyle,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PolicyDenialNotice, policyDenialFromError } from "@/policy";
import { unitHref } from "@/shared/ui/link";

export function NewRealmPage() {
  const { t } = useTranslation(["common", "entity"]);
  const navigate = useNavigate();
  const createMutation = useCreateRealmMutation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagViewStyle, setTagViewStyle] = useState<RealmTagViewStyle>("flat");
  const [allowTagViewSwitch, setAllowTagViewSwitch] = useState(true);

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
        extra: {
          tagView: {
            defaultStyle: tagViewStyle,
            allowViewerSwitch: allowTagViewSwitch,
          },
        },
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
      <h1 className="mb-6 text-2xl font-semibold">
        {t("entity:realm_new_title")}
      </h1>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-realm-name">{t("common:name")}</Label>
          <Input
            id="new-realm-name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-realm-description">
            {t("common:description")}
          </Label>
          <Textarea
            id="new-realm-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold leading-ui text-text-primary">
              Tags tab view
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-realm-tag-view-style">Default view</Label>
              <Select
                value={tagViewStyle}
                onValueChange={(value) =>
                  setTagViewStyle(value as RealmTagViewStyle)
                }
              >
                <SelectTrigger id="new-realm-tag-view-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat</SelectItem>
                  <SelectItem value="grouped">Grouped</SelectItem>
                  <SelectItem value="tree">Tree</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant={allowTagViewSwitch ? "secondary" : "outline"}
              onClick={() => setAllowTagViewSwitch((value) => !value)}
            >
              {allowTagViewSwitch ? "Viewer switch on" : "Viewer switch off"}
            </Button>
          </div>
        </section>
        <PolicyDenialNotice
          denial={policyDenialFromError(createMutation.error)}
        />
        <div className="flex flex-row justify-end">
          <Button
            onClick={handleCreate}
            disabled={!title || createMutation.isPending}
          >
            {t("common:create")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NewRealmPage;
