import React from 'react';
import {
  Alert,
  Avatar,
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import {useTranslation} from 'react-i18next';
import {Link} from '@package/ui/Navigation/Link.tsx';
import {SectionHeader} from '../components/SectionHeader';
import {useHomeReviews} from '../../hooks/hooks';

export type ReviewsSectionProps = {
  limit?: number;
};

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({limit = 6}) => {
  const {t} = useTranslation();
  const {items, error, isLoading} = useHomeReviews(limit);

  if (error) {
    return (
      <div className="w-full">
        <SectionHeader
          title={t('review.top_rated_short_reviews')}
          isLoading={isLoading}
        />
        <Alert severity="error" className="mt-2">
          {String(error)}
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <SectionHeader
        title={t('review.top_rated_short_reviews')}
        subtitle={t('page.home.discovery.top_rated_reviews_subtitle')}
        isLoading={isLoading}
      />
      <div className="flex-1 overflow-y-auto space-y-3 mt-3">
        <Stack spacing={2}>
          {items.map(review => (
            <Card
              key={(review as any).unitId}
              className="rounded-lg"
              elevation={1}
            >
              <CardActionArea
                component={Link}
                to={`/review/${(review as any).unitId}`}
              >
                <CardHeader
                  avatar={
                    (review as any).user ? (
                      <Avatar
                        src={(review as any).user.avatar ?? undefined}
                        alt={(review as any).user.name}
                        sx={{width: 36, height: 36}}
                      />
                    ) : undefined
                  }
                  title={(review as any).title || t('review.short_review')}
                  subheader={(review as any).user?.name}
                />
                <CardContent>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    className="line-clamp-3 mt-1"
                  >
                    {(review as any).content}
                  </Typography>
                </CardContent>
                <CardActions className="px-3 pb-3">
                  {typeof (review as any).rating === 'number' && (
                    <Chip
                      size="small"
                      color="primary"
                      label={`${(review as any).rating.toFixed(1)}`}
                    />
                  )}
                </CardActions>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      </div>
    </div>
  );
};
