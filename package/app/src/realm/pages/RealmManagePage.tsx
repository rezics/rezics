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
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PinboardAdminSection } from "@/pinboard";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { canManageRealm } from "../models/canManageRealm";

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

  const translation = realm ? getTranslation(realm.translations) : null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const allowed = canManageRealm({
    permission,
    memberRoleKey: membership?.roleKey,
  });

  useEffect(() => {
    if (!isLoading && !membershipLoading && !allowed) {
      navigate({ to: "/realm/$realmId", params: { realmId } });
    }
  }, [isLoading, membershipLoading, allowed, navigate, realmId]);

  useEffect(() => {
    if (translation) {
      setTitle(translation.title ?? "");
      setDescription(translation.description ?? "");
    }
  }, [translation]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const language = translation?.language ?? DEFAULT_LANGUAGE;

      await unitApi.upsertTranslation(realmId, language, {
        title,
        description,
      });

      await queryClient.invalidateQueries({
        queryKey: realmKeys.detail(realmId),
      });

      navigate({ to: "/realm/$realmId", params: { realmId } });
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
          <Label htmlFor="realm-name">Name</Label>
          <Input
            id="realm-name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="realm-description">Description</Label>
          <textarea
            id="realm-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-rezics-color-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <PinboardAdminSection
          realmUnitId={realmId}
          isDefaultRealm={isDefaultRealm}
        />
        <div className="flex flex-row justify-end gap-4">
          <Button
            variant="ghost"
            onClick={() =>
              navigate({ to: "/realm/$realmId", params: { realmId } })
            }
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export default RealmManagePage;
