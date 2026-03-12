import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type {FC, ReactNode} from 'react';

export interface CookieConsentBannerProps {
  title: string;
  body: string;
  policyLabel: string;
  onAccept: () => void;
  onPolicyClick: () => void;
  acceptLabel?: string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  policyAction?: ReactNode;
}

export const CookieConsentBanner: FC<CookieConsentBannerProps> = ({
  title,
  body,
  policyLabel,
  onAccept,
  onPolicyClick,
  acceptLabel = 'Accept',
  secondaryAction,
  policyAction,
}) => {
  return (
    <section aria-label={title}>
      <Stack
        spacing={2}
        role="region"
        sx={{
          border: theme => `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          p: 2,
          backgroundColor: theme => theme.palette.background.paper,
        }}
      >
        <div>
          <Typography component="h2" variant="h6">
            {title}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {body}
          </Typography>
        </div>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {policyAction ?? (
            <Button type="button" variant="text" onClick={onPolicyClick}>
              {policyLabel}
            </Button>
          )}
          {secondaryAction ? (
            <Button type="button" variant="outlined" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
          <Button type="button" variant="contained" onClick={onAccept}>
            {acceptLabel}
          </Button>
        </Stack>
      </Stack>
    </section>
  );
};
