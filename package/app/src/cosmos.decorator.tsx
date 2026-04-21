import { ThemeProvider } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { StyledEngineProvider } from "@mui/material/styles";
import { getTheme } from "@rezics/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import { qc } from "./app/providers/reactQueryUtil";

export default function GlobalDecorator({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = getTheme("light");

  return (
    <QueryClientProvider client={qc}>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </StyledEngineProvider>
    </QueryClientProvider>
  );
}
