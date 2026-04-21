import { Box } from "@mui/material";
import { ReplyComposer } from "./ReplyComposer";

export default {
  "progressive · empty": () => (
    <Box p={2}>
      <ReplyComposer
        mode="progressive"
        targetUnitId="fixture-target-1"
        placeholder="Start a discussion"
      />
    </Box>
  ),
  "progressive · autoFocus": () => (
    <Box p={2}>
      <ReplyComposer
        mode="progressive"
        autoFocus
        targetUnitId="fixture-target-2"
      />
    </Box>
  ),
  "expanded · inline reply": () => (
    <Box p={2}>
      <ReplyComposer
        mode="expanded"
        targetUnitId="fixture-target-3"
        parentPostUnitId="fixture-parent-3"
      />
    </Box>
  ),
};
