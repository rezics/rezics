import {
  collectLocatorSummaries,
  dumpElementStyle,
  highlightLocator,
  keepBrowserOpen,
  openInvestigationPage,
  pauseForUser,
} from "./src";

const investigation = await openInvestigationPage({
  url: "https://example.com",
});

const { page } = investigation;

await pauseForUser(
  "If this page needs Cloudflare/login/captcha verification, complete it now, then press Enter.",
);

const byCss = page.locator("p");
const byText = page.getByText("Example Domain");
const byPlaywrightLocator = page.locator('p:has-text("illustrative examples")');

const target = byText.or(byPlaywrightLocator).or(byCss).first();

await highlightLocator(target, { label: "current-target" });

console.dir(await collectLocatorSummaries(target), { depth: null });
console.dir(await dumpElementStyle(target), { depth: null });

await keepBrowserOpen();
