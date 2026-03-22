import {useQuery} from '@tanstack/react-query';
import {echoKvGetQuery} from '@package/api/echokv/echokv';
import {parseEchoKVResponse} from '@package/api/echokv/util';
import {AnnouncementBar, type Announcement} from '../component/AnnouncementBar';
import {Skeleton} from '@mui/material';

export const AnnouncementBarSection = () => {
  const {data, isLoading} = useQuery(echoKvGetQuery('home_notice'));

  if (isLoading) return <Skeleton variant="rectangular" height={40} />;

  if (!data || !Array.isArray(data)) return;

  return (
    <AnnouncementBar
      announcements={parseEchoKVResponse(data) as Announcement[]}
      max={4}
    />
  );
};
