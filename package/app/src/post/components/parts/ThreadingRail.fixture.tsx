import { Box } from "@mui/material";
import { useState } from "react";
import { ThreadingHoverProvider } from "./ThreadingContext";
import { ThreadingRail } from "./ThreadingRail";

function Row({ initialCollapsed = false }: { initialCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  return (
    <ThreadingHoverProvider>
      <Box sx={{ position: "relative", pl: "40px", py: 6, height: 120 }}>
        <ThreadingRail
          leftPx={30}
          isCollapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
        <Box sx={{ color: "text.secondary" }}>
          Hover the 12 px rail zone to see the stroke highlight.
        </Box>
      </Box>
    </ThreadingHoverProvider>
  );
}

export default {
  "expanded row": () => <Row initialCollapsed={false} />,
  "collapsed row": () => <Row initialCollapsed />,
};
