import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { myRealmMembershipQuery, realmDetailQuery } from "@rezics/api/realm/realm";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { JoinButton } from "../components/JoinButton";
import { RealmContentFeed } from "../components/RealmContentFeed";
import { RealmMemberList } from "../components/RealmMemberList";
import { RealmTagManager } from "../components/RealmTagManager";
import { useServerPermission } from "@rezics/api/hooks";
import { canManageRealm } from "../models/canManageRealm";

interface RealmPageProps {
  realmId: string;
}

export function RealmPage({ realmId }: RealmPageProps) {
  const { data: realm, isLoading } = useQuery(realmDetailQuery(realmId));
  const { data: membership } = useQuery(myRealmMembershipQuery(realmId));
  const permission = useServerPermission();
  const [tab, setTab] = useState<"feed" | "tags" | "members">("feed");

  const showManage = canManageRealm({
    permission,
    memberRoleKey: membership?.roleKey,
  });

  if (isLoading) {
    return (<Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>);
  }

  if (!realm) {
    return <Typography color="text.secondary" py={4}>Realm not found</Typography>;
  }

  const translation = getTranslation(realm.translations);
  const title = translation?.title ?? "Untitled Realm";
  const description = translation?.description ?? "";

  return (
    <Box maxWidth="lg" mx="auto" px={2} py={3}>
      <Stack spacing={2} mb={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h5" fontWeight={600}>{title}</Typography>
            {showManage && (
              <Link to="/realm/$realmId/manage" params={{ realmId }}>
                <IconButton size="small">
                  <TuneRoundedIcon fontSize="small" />
                </IconButton>
              </Link>
            )}
          </Stack>
          <JoinButton realmId={realmId} />
        </Stack>
        {description && (
          <Typography variant="body1" color="text.secondary">{description}</Typography>
        )}
        <Stack direction="row" spacing={2}>
          <Typography variant="caption" color="text.secondary">
            {realm.memberCount ?? 0} members
          </Typography>
          {realm.isPublic && (
            <Typography variant="caption" color="primary">Public</Typography>
          )}
          {realm.isOfficial && (
            <Typography variant="caption" color="secondary">Official</Typography>
          )}
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Feed" value="feed" />
        <Tab label="Tags" value="tags" />
        <Tab label="Members" value="members" />
      </Tabs>

      {tab === "feed" && <RealmContentFeed realmId={realmId} />}
      {tab === "tags" && <RealmTagManager realmId={realmId} />}
      {tab === "members" && <RealmMemberList realmId={realmId} />}
    </Box>
  );
}

export default RealmPage;
