import { createRoot } from "react-dom/client";

import "./index.css";

import Router from "./routers/router";

const root = createRoot(document.getElementById("app")!);
root.render(Router);
