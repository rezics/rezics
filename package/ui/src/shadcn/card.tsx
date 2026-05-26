// Rezics-aligned shadcn exception — see
// `openspec/specs/ui-component-foundation/spec.md`,
// "Requirement: shadcn primitive manual changes are documented".
// Do not run `shadcn@latest add card` without reconciling this file's
// documented surface/interactive API, media slot, and container-query behavior.
import type * as React from "react";

import { cn } from "#/shared/lib/utils";

export type CardSurface = "plain" | "contained" | "elevated";
export type CardElevation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

type CardStyle = React.CSSProperties & {
  "--card-elevation-hover-shadow"?: string;
  "--card-elevation-hover-transform"?: string;
  "--card-elevation-shadow"?: string;
};

const cardSurfaceClasses: Record<CardSurface, string> = {
  plain: "bg-transparent text-text-primary shadow-none ring-0",
  contained: "bg-surface-base text-text-primary shadow-none ring-0",
  elevated:
    "bg-surface-canvas text-text-primary ring-0 [box-shadow:var(--card-elevation-shadow)]",
};

const cardInteractiveClasses: Record<CardSurface, string> = {
  plain:
    "p-2 hover:bg-surface-subtle data-[size=sm]:p-2 has-[>img:first-child]:pt-2 has-[>[data-slot=card-media]:first-child]:pt-2 has-[>img:last-child]:pb-2 has-[>[data-slot=card-media]:last-child]:pb-2",
  contained: "hover:bg-surface-elevated",
  elevated:
    "hover:[box-shadow:var(--card-elevation-hover-shadow)] hover:[transform:var(--card-elevation-hover-transform)]",
};

const cardElevationStyles: Record<CardElevation, CardStyle> = {
  1: {
    "--card-elevation-hover-shadow": "var(--shadow-1)",
    "--card-elevation-hover-transform": "translateY(-1px)",
    "--card-elevation-shadow": "none",
  },
  2: {
    "--card-elevation-hover-shadow": "var(--shadow-1)",
    "--card-elevation-hover-transform": "translateY(-1px)",
    "--card-elevation-shadow": "0 1px 1px rgba(0, 0, 0, 0.03)",
  },
  3: {
    "--card-elevation-hover-shadow": "var(--shadow-2)",
    "--card-elevation-hover-transform": "translateY(-2px)",
    "--card-elevation-shadow": "var(--shadow-1)",
  },
  4: {
    "--card-elevation-hover-shadow": "var(--shadow-2)",
    "--card-elevation-hover-transform": "translateY(-2px)",
    "--card-elevation-shadow":
      "0 1px 2px rgba(0, 0, 0, 0.05), 0 3px 8px rgba(0, 0, 0, 0.05)",
  },
  5: {
    "--card-elevation-hover-shadow": "var(--shadow-3)",
    "--card-elevation-hover-transform": "translateY(-2px)",
    "--card-elevation-shadow": "var(--shadow-2)",
  },
  6: {
    "--card-elevation-hover-shadow": "var(--shadow-3)",
    "--card-elevation-hover-transform": "translateY(-3px)",
    "--card-elevation-shadow":
      "0 2px 4px rgba(0, 0, 0, 0.06), 0 8px 16px rgba(0, 0, 0, 0.06)",
  },
  7: {
    "--card-elevation-hover-shadow": "var(--shadow-3)",
    "--card-elevation-hover-transform": "translateY(-3px)",
    "--card-elevation-shadow": "var(--shadow-3)",
  },
  8: {
    "--card-elevation-hover-shadow": "var(--shadow-modal)",
    "--card-elevation-hover-transform": "translateY(-4px)",
    "--card-elevation-shadow":
      "0 4px 8px rgba(0, 0, 0, 0.07), 0 12px 24px rgba(0, 0, 0, 0.08)",
  },
  9: {
    "--card-elevation-hover-shadow": "var(--shadow-modal)",
    "--card-elevation-hover-transform": "translateY(-4px)",
    "--card-elevation-shadow": "var(--shadow-modal)",
  },
  10: {
    "--card-elevation-hover-shadow": "var(--shadow-modal)",
    "--card-elevation-hover-transform": "translateY(-5px)",
    "--card-elevation-shadow":
      "0 8px 16px rgba(0, 0, 0, 0.08), 0 20px 40px rgba(0, 0, 0, 0.10)",
  },
};

function Card({
  className,
  elevation = 6,
  interactive = false,
  size = "default",
  style,
  surface = "contained",
  ...props
}: React.ComponentProps<"div"> & {
  elevation?: CardElevation;
  interactive?: boolean;
  size?: "default" | "sm";
  surface?: CardSurface;
}) {
  const elevationStyle =
    surface === "elevated" ? cardElevationStyles[elevation] : undefined;

  return (
    <div
      data-slot="card"
      data-elevation={surface === "elevated" ? elevation : undefined}
      data-interactive={interactive ? "true" : undefined}
      data-size={size}
      data-surface={surface}
      className={cn(
        "group/card @container/card flex flex-col gap-6 overflow-hidden rounded-md py-6 text-sm transition-[background-color,box-shadow,transform] duration-200 ease-out data-[size=sm]:gap-4 data-[size=sm]:py-4 has-[>img:first-child]:pt-0 has-[>[data-slot=card-media]:first-child]:pt-0 has-[>img:last-child]:pb-0 has-[>[data-slot=card-media]:last-child]:pb-0 *:[img:first-child]:rounded-t-md *:[img:last-child]:rounded-b-md",
        cardSurfaceClasses[surface],
        interactive &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
        interactive && cardInteractiveClasses[surface],
        className,
      )}
      style={elevationStyle ? { ...elevationStyle, ...style } : style}
      {...props}
    />
  );
}

function CardMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-media"
      className={cn(
        "overflow-hidden first:rounded-t-md last:rounded-b-md [&>img]:h-full [&>img]:w-full [&>img]:object-cover",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1.5 rounded-t-md px-6 group-data-[surface=plain]/card:px-4 group-data-[size=sm]/card:px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-6 group-data-[size=sm]/card:[.border-b]:pb-4",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-base font-medium", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn(
        "px-6 group-data-[surface=plain]/card:px-4 group-data-[size=sm]/card:px-4",
        className,
      )}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-md px-6 group-data-[surface=plain]/card:px-4 group-data-[size=sm]/card:px-4 [.border-t]:pt-6 group-data-[size=sm]/card:[.border-t]:pt-4",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardMedia,
  CardTitle,
};
