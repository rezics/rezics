import type React from "react";
import {
  AccentBar,
  type AccentBarProps,
} from "#/primitive/decorative/AccentBar";

type Variant = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "body1" | "body2";

const VARIANT_CLASS: Record<Variant, string> = {
  h1: "text-4xl",
  h2: "text-3xl",
  h3: "text-2xl",
  h4: "text-xl",
  h5: "text-lg",
  h6: "text-base",
  body1: "text-base",
  body2: "text-sm",
};

export interface AccentBarWithTextProps extends AccentBarProps {
  text: React.ReactNode;
  typographyVariant?: Variant;
  typographyProps?: React.HTMLAttributes<HTMLDivElement>;
  gap?: number;
}

export const AccentBarWithText: React.FC<AccentBarWithTextProps> = ({
  text,
  typographyVariant = "h5",
  typographyProps,
  gap = 8,
  ...barProps
}) => {
  const className = [
    VARIANT_CLASS[typographyVariant],
    "font-bold flex items-center",
    typographyProps?.className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      {...typographyProps}
      className={className}
      style={{ gap: `${gap}px`, ...typographyProps?.style }}
    >
      <AccentBar {...barProps} />
      {text}
    </div>
  );
};
