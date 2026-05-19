import { useServerPermission } from "@rezics/api/hooks";
import { getDefaultRealmId } from "@rezics/api/infra/bootstrap";
import {
  myRealmMembershipQuery,
  realmDetailQuery,
  realmKeys,
  useUpdateRealmMutation,
} from "@rezics/api/realm/realm";
import { unitApi } from "@rezics/api/unit/unit";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { unitHref } from "@rezics/ui/primitive/link";
import { Button, Input, Label, Textarea } from "@rezics/ui/shadcn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PinboardAdminSection } from "@/pinboard";
import {
  AddUnitTranslationLanguageDialog,
  UnitTranslationLanguageBar,
} from "@/unit";
import { canManageRealm } from "../models/canManageRealm";
import { RealmExtraManageSection } from "../sections/RealmExtraManageSection";

interface RealmManagePageProps {
  realmId: string;
}

export function RealmManagePage({ realmId }: RealmManagePageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: realm, isLoading } = useQuery(realmDetailQuery(realmId));
  const { data: membership, isLoading: membershipLoading } = useQuery(
    myRealmMembershipQuery(realmId),
  );
  const permission = useServerPermission();
  // updateMutation kept for completeness; actual save runs through unitApi
  useUpdateRealmMutation();

  const existingLanguages = useMemo(
    () =>
      (realm?.translations ?? [])
        .map((translation) => translation.language as string | undefined)
        .filter((language): language is string => Boolean(language)),
    [realm?.translations],
  );
  const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_LANGUAGE);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draftLanguages, setDraftLanguages] = useState<string[]>([]);
  const editableLanguages = useMemo(
    () => [
      ...existingLanguages,
      ...draftLanguages.filter(
        (language) => !existingLanguages.includes(language),
      ),
    ],
    [draftLanguages, existingLanguages],
  );

  const allowed = canManageRealm({
    permission,
    memberRoleKey: membership?.roleKey,
  });

  useEffect(() => {
    if (!isLoading && !membershipLoading && !allowed) {
      navigate({
        to: unitHref({
          type: "REALM",
          unitId: realmId,
          slug: realm?.slug ?? null,
        }),
      });
    }
  }, [isLoading, membershipLoading, allowed, navigate, realmId, realm?.slug]);

  const translation = realm?.translations?.find(
    (item) => item.language === selectedLanguage,
  );

  useEffect(() => {
    if (
      editableLanguages.length > 0 &&
      !editableLanguages.includes(selectedLanguage)
    ) {
      setSelectedLanguage(editableLanguages[0] ?? DEFAULT_LANGUAGE);
    }
  }, [editableLanguages, selectedLanguage]);

  useEffect(() => {
    setTitle(translation?.title ?? "");
    setDescription(translation?.description ?? "");
  }, [translation]);

  const handleAddLanguage = (language: string) => {
    setAddOpen(false);
    setDraftLanguages((prev) =>
      prev.includes(language) ? prev : [...prev, language],
    );
    setSelectedLanguage(language);
    setTitle("");
    setDescription("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await unitApi.upsertTranslation(realmId, selectedLanguage, {
        title,
        description,
      });

      await queryClient.invalidateQueries({
        queryKey: realmKeys.detail(realmId),
      });

      navigate({
        to: unitHref({
          type: "REALM",
          unitId: realmId,
          slug: realm?.slug ?? null,
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || membershipLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  const isDefaultRealm = realmId === getDefaultRealmId();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">Manage Realm</h1>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <UnitTranslationLanguageBar
            existingLanguages={editableLanguages}
            selectedLanguage={selectedLanguage}
            onSelect={setSelectedLanguage}
            onAddClick={() => setAddOpen(true)}
            label="Language"
            addLabel="Add translation"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="realm-name">Name</Label>
          <Input
            id="realm-name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="realm-description">Description</Label>
          <Textarea
            id="realm-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>
        <PinboardAdminSection
          realmUnitId={realmId}
          isDefaultRealm={isDefaultRealm}
        />
        <RealmExtraManageSection realmId={realmId} extra={realm?.extra} />
        <div className="flex flex-row justify-end gap-4">
          <Button
            variant="ghost"
            onClick={() =>
              navigate({
                to: unitHref({
                  type: "REALM",
                  unitId: realmId,
                  slug: realm?.slug ?? null,
                }),
              })
            }
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Save
          </Button>
        </div>
      </div>
      <AddUnitTranslationLanguageDialog
        open={addOpen}
        existingLanguages={editableLanguages}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddLanguage}
        title="Add translation"
        languageLabel="Language"
        cancelLabel="Cancel"
        submitLabel="Add"
      />
    </div>
  );
}

export default RealmManagePage;
