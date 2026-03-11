import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import {Box} from '@mui/material';
import type {FC, ReactNode} from 'react';
import {useTheme} from '@mui/material/styles';

interface AuthProviderButtonProps {
  label: string;
  icon?: ReactNode;
  compact?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export const AuthProviderButton: FC<AuthProviderButtonProps> = ({
  label,
  icon,
  compact = false,
  loading = false,
  disabled = false,
  onClick,
}) => {
  const theme = useTheme();

  return (
    <Button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={label}
      sx={{
        position: 'relative',

        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',

        textTransform: 'none',
        fontWeight: 400,

        px: compact ? 1.5 : 2,
        py: compact ? 0.75 : 1,
        fontSize: compact ? '0.8125rem' : '0.875rem',

        color: theme.palette.text.primary,

        border: `1px solid ${theme.palette.grey[400]}`,
        borderRadius: theme.shape.borderRadius,

        backgroundColor: theme.palette.background.paper,

        '&:hover': {
          borderColor: theme.palette.primary.main,
          backgroundColor: theme.palette.action.hover,
        },

        '&:active': {
          borderColor: theme.palette.primary.main,
        },

        '&.Mui-disabled': {
          opacity: 0.6,
        },
      }}
    >
      {/* icon absolute，保证文字始终居中 */}
      {!loading && icon && (
        <Box
          sx={{
            position: 'absolute',
            left: compact ? 6 : 10,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {icon}
        </Box>
      )}

      {loading ? <CircularProgress size={18} /> : label}
    </Button>
  );
};
