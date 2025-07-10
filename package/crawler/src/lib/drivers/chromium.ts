import { chromium as c } from "rebrowser-playwright";

export const chromium = await c.launch({ headless: false, timeout: 0 });
