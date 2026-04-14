import { ThemeProvider } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { StyledEngineProvider } from "@mui/material/styles";
import { getTheme } from "@rezics/ui";
import type React from "react";

export default function GlobalDecorator({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = getTheme("light");

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </StyledEngineProvider>
  );
}
