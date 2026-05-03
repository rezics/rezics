import { Typography } from "@mui/material";
import type { FC } from "react";
import {
  type ChipDefinition,
  InnerFilterPanel,
} from "@/user/components/InnerFilterPanel";

// MOCK: reaction history tabs — disabled until backend endpoint is available
const FILTER_CHIPS: ChipDefinition[] = [
  { value: "given", label: "Given", disabled: true },
  { value: "received", label: "Received", disabled: true },
];

// MOCK: reactions tab placeholder — backend reaction history API not yet available
export const ReactionsTabSection: FC = () => (
  <div className="flex flex-col gap-4 py-4">
    <InnerFilterPanel
      chips={FILTER_CHIPS}
      activeValue=""
      onChipChange={() => {}}
    />

    <Typography
      variant="body2"
      color="text.secondary"
      className="py-12 text-center"
    >
      Reaction history is coming soon
    </Typography>
  </div>
);
