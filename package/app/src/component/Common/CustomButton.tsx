import { Button, CircularProgress } from "@mui/material";

export function RoseButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Button
        variant="contained"
        size="large"
        onClick={onClick}
        disabled={disabled}
        startIcon={disabled
          ? <CircularProgress size={16} className="text-white" />
          : null}
        className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 
                rounded-xl px-8 py-3 text-base font-semibold normal-case
                shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 
                hover:-translate-y-0.5 transition-all duration-300 
                disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
      >
        {label}
      </Button>
    </div>
  );
}

export function GreenButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Button
        variant="contained"
        size="large"
        onClick={onClick}
        disabled={disabled}
        startIcon={disabled
          ? <CircularProgress size={16} className="text-white" />
          : null}
        className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 
                rounded-xl px-8 py-3 text-base font-semibold normal-case
                shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 
                hover:-translate-y-0.5 transition-all duration-300 
                disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
      >
        {label}
      </Button>
    </div>
  );
}

export function OrangeButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Button
        variant="contained"
        size="large"
        onClick={onClick}
        disabled={disabled}
        startIcon={disabled
          ? <CircularProgress size={16} className="text-white" />
          : null}
        className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 
                rounded-xl px-8 py-3 text-base font-semibold normal-case
                shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 
                hover:-translate-y-0.5 transition-all duration-300 
                disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
      >
        {label}
      </Button>
    </div>
  );
}
