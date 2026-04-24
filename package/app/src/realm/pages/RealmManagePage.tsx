import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
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
  const updateMutation = useUpdateRealmMutation();

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

      // Upsert translation via unit translation endpoint
      await unitApi.upsertTranslation(realmId, language, {
        title,
        description,
      });

      // Invalidate realm detail to pick up updated translations
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
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (!allowed) {
    return null;
  }

  const isDefaultRealm = realmId === getDefaultRealmId();

  return (
    <Box maxWidth="md" mx="auto" px={2} py={3}>
      <Typography variant="h5" fontWeight={600} mb={3}>
        Manage Realm
      </Typography>
      <Stack spacing={3}>
        <TextField
          label="Name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          multiline
          rows={4}
          variant="standard"
        />
        <PinboardAdminSection
          realmUnitId={realmId}
          isDefaultRealm={isDefaultRealm}
        />
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            variant="text"
            onClick={() =>
              navigate({ to: "/realm/$realmId", params: { realmId } })
            }
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSave}
            disabled={saving}
          >
            Save
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default RealmManagePage;
