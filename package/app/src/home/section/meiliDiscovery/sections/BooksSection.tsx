import React from 'react';
import {
  Alert,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Typography,
} from '@mui/material';
import {useTranslation} from 'react-i18next';
import {Link} from '@package/ui/Navigation/Link.tsx';
import {SectionHeader} from '../components/SectionHeader';
import {useHomeBooks} from '../../hooks/hooks';

export type BooksSectionProps = {
  limit?: number;
};

export const BooksSection: React.FC<BooksSectionProps> = ({limit = 50}) => {
  const {t} = useTranslation();
  const {items, error, isLoading} = useHomeBooks(limit);

  if (error) {
    return (
      <div className="w-full">
        <SectionHeader
          title={t('page.home.discovery.recommended_for_you')}
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
        title={t('page.home.discovery.recommendations')}
        subtitle={t('page.home.discovery.meili_subtitle')}
        isLoading={isLoading}
      />
      <div className="flex-1 overflow-y-auto space-y-3 mt-3">
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map(book => {
            if ((book as any).coverUrl === null) {
              return null;
            }
            return (
              <div
                key={(book as any).unitId}
                className="transition-all duration-300 ease-out"
              >
                <Card className="rounded-lg overflow-hidden shadow-sm">
                  <CardActionArea
                    component={Link}
                    to={`/book/${(book as any).unitId}`}
                  >
                    {(book as any).coverUrl && (
                      <CardMedia
                        component="img"
                        height="180"
                        image={(book as any).coverUrl}
                        alt={(book as any).title}
                        className="object-cover w-full"
                      />
                    )}
                    <CardContent>
                      <Typography variant="subtitle2" className="truncate">
                        {(book as any).title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        className="truncate"
                      >
                        {(() => {
                          const a: any = (book as any).author;
                          if (!a) return '';
                          if (typeof a === 'string') return a;
                          if (Array.isArray(a))
                            return a
                              .map((x: any) =>
                                typeof x === 'string' ? x : (x?.name ?? ''),
                              )
                              .filter(Boolean)
                              .join(', ');
                          return (a?.name as string) ?? '';
                        })()}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
