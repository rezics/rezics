import Button from '@mui/material/Button';
import type {FC} from 'react';

interface AuthProviderButtonProps {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export const AuthProviderButton: FC<AuthProviderButtonProps> = ({
  label,
  loading = false,
  disabled = false,
  onClick,
}) => {
  return (
    <Button
      type="button"
      variant="outlined"
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={label}
    >
      {loading ? 'Redirecting…' : label}
    </Button>
  );
};
