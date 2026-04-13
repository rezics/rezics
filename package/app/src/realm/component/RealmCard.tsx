import { Card, CardActionArea, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { RealmDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { getTranslation } from "@/shared/util/translation-helpers";

interface RealmCardProps {
  realm: RealmDTO;
}

export const RealmCard: React.FC<RealmCardProps> = ({ realm }) => {
  const navigate = useNavigate();
  const translation = getTranslation(realm.unit?.translations);
  const title = translation?.title ?? "Untitled Realm";
  const description = translation?.description ?? "";

  return (
    <Card elevation={0}>
      <CardActionArea onClick={() => navigate({ to: "/realm/$realmId", params: { realmId: realm.unitId } })}>
        <CardContent>
          <Typography variant="h6" className="truncate">{title}</Typography>
          <Typography variant="body2" color="text.secondary" className="line-clamp-2 mt-1">{description || "No description"}</Typography>
          <Stack direction="row" spacing={1} mt={2} alignItems="center">
            <Typography variant="caption" color="text.secondary">{realm.memberCount ?? 0} members</Typography>
            {realm.isPublic && <Chip label="Public" size="small" variant="outlined" />}
            {realm.isOfficial && <Chip label="Official" size="small" color="primary" variant="outlined" />}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};
