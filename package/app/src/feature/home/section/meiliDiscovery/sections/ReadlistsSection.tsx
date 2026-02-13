import React from 'react';
import {Alert, Card, CardActionArea, CardContent, Stack, Typography} from '@mui/material';
import {useTranslation} from 'react-i18next';
import {LazyLoadImage} from '@/component/Common/LazyLoadImage';
import {Link} from '@package/ui/Navigation/Link.tsx';
import {SectionHeader} from '../components/SectionHeader';
import {useHomeReadlists} from '../hooks';

export type ReadlistsSectionProps = {
  limit?: number;
};

export const ReadlistsSection: React.FC<ReadlistsSectionProps> = ({
  limit = 6,
}) => {
  const {t} = useTranslation();
  const {items, error, isLoading} = useHomeReadlists(limit);

  if (error) {
    return (
      <div className="w-full">
        <SectionHeader title={t('readlist.featured')} isLoading={isLoading} />
        <Alert severity="error" className="mt-2">
          {String(error)}
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <SectionHeader
        title={t('readlist.featured')}
        subtitle={t('page.home.discovery.featured_readlists_subtitle')}
        isLoading={isLoading}
      />
      <div className="flex-1 overflow-y-auto space-y-3 mt-3">
        <Stack spacing={2}>
          {items.map(list => (
            <Card key={(list as any).id} className="rounded-lg" elevation={1}>
              <CardActionArea component={Link} to={`/readlist/${(list as any).id}`}>
                <CardContent className="flex gap-3 items-start">
                  {(list as any).coverUrl && (
                    <div className="shrink-0">
                      <LazyLoadImage
                        src={(list as any).coverUrl}
                        alt={(list as any).title}
                        className="w-20 h-24 object-cover rounded"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Typography variant="subtitle2" className="truncate">
                      {(list as any).title}
                    </Typography>
                    {(list as any).creator && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        className="line-clamp-3"
                      >
                        {(list as any).content}
                      </Typography>
                    )}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      className="truncate mt-1 block"
                    >
                      {(list as any).books?.length
                        ? t('readlist.includes_books', {
                            count: (list as any).books.length,
                          })
                        : ''}{' '}
                      {(list as any).reviews?.length
                        ? t('readlist.includes_reviews', {
                            count: (list as any).reviews.length,
                          })
                        : ''}
                    </Typography>
                  </div>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      </div>
    </div>
  );
};

