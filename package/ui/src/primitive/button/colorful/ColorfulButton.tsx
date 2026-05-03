import { Button } from "@/shadcn/button";
import { Spinner } from "@/primitive/feedback/Spinner";

export type ColorfulButtonColor = "green" | "orange" | "rose";

const COLOR_CLASSES: Record<ColorfulButtonColor, string> = {
  green:
    "bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 text-white",
  orange:
    "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 text-white",
  rose: "bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-pink-500/40 text-white",
};

export interface ColorfulButtonProps {
  color: ColorfulButtonColor;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function ColorfulButton({
  color,
  label,
  onClick,
  disabled,
}: ColorfulButtonProps) {
  return (
    <div>
      <Button
        size="lg"
        onClick={onClick}
        disabled={disabled}
        className={`${COLOR_CLASSES[color]} rounded-xl px-12 py-3 text-base font-semibold hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none`}
      >
        {disabled ? <Spinner size="sm" className="mr-2" /> : null}
        {label}
      </Button>
    </div>
  );
}
