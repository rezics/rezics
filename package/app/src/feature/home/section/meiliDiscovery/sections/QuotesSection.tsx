import React from 'react';
import {Alert, Card, CardActionArea, CardContent, Stack, Typography} from '@mui/material';
import {useTranslation} from 'react-i18next';
import {Link} from '@package/ui/Navigation/Link.tsx';
import {SectionHeader} from '../components/SectionHeader';
import {useHomeQuotes} from '../hooks';

export type QuotesSectionProps = {
  limit?: number;
};

export const QuotesSection: React.FC<QuotesSectionProps> = ({limit = 6}) => {
  const {t} = useTranslation();
  const {items, error, isLoading} = useHomeQuotes(limit);

  if (error) {
    return (
      <div className="w-full">
        <SectionHeader
          title={t('quote.title')}
          subtitle={t('quote.subtitle')}
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
        title={t('quote.title')}
        subtitle={t('quote.subtitle')}
        isLoading={isLoading}
      />
      <div className="flex-1 overflow-y-auto space-y-3 mt-3">
        <Stack spacing={2}>
          {items.map(quote => (
            <Card key={(quote as any).id} className="rounded-lg" elevation={1}>
              <CardActionArea component={Link} to={`/quote/${(quote as any).id}`}>
                <CardContent>
                  <Typography
                    variant="body1"
                    className="mb-1"
                    color="text.primary"
                  >
                    “{(quote as any).text}”
                  </Typography>
                  {(quote as any).from && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      className="truncate"
                    >
                      —— {(quote as any).from}
                    </Typography>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      </div>
    </div>
  );
};

