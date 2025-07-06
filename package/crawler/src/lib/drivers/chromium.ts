import { chromium as c } from "playwright";

export const chromium = await c.launch({ headless: false, timeout: 0 });
