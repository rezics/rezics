import { createRoot } from "react-dom/client";
import { useState } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { getTheme } from "@/config/theme";
import Router from "./routes/router";
import "./index.css";

// 定义传递给 Router 的 props 类型
interface RouterProps {
  mode: 'light' | 'dark';
  toggleTheme: () => void;
}

const App = () => {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeProvider theme={getTheme(mode)}>
      <CssBaseline />
      {(Router as (props: RouterProps) => React.ReactNode)({ mode, toggleTheme })}
    </ThemeProvider>
  );
};

const root = createRoot(document.getElementById("app")!);
root.render(<App />);
