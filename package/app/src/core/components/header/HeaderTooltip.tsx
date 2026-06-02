import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import type React from "react";

const HEADER_TOOLTIP_DELAY_MS = 500;

interface HeaderTooltipProps {
  label: React.ReactNode;
  children: React.ReactElement;
}

export function HeaderTooltip({ label, children }: HeaderTooltipProps) {
  return (
    <TooltipProvider delay={HEADER_TOOLTIP_DELAY_MS}>
      <Tooltip>
        <TooltipTrigger render={children} />
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
