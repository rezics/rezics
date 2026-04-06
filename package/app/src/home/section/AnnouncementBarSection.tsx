import { Skeleton } from "@mui/material";
import { echoKvGetQuery } from "@rezics/api/echokv/echokv";
import { parseEchoKVResponse } from "@rezics/api/echokv/util";
import { useQuery } from "@tanstack/react-query";
import {
  type Announcement,
  AnnouncementBar,
} from "../component/AnnouncementBar";

export const AnnouncementBarSection = () => {
  const { data, isLoading } = useQuery(echoKvGetQuery("home_notice"));

  if (isLoading) return <Skeleton variant="rectangular" height={40} />;

  if (!data || !Array.isArray(data)) return;

  return (
    <AnnouncementBar
      announcements={parseEchoKVResponse(data) as Announcement[]}
      max={4}
    />
  );
};
