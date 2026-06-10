import { createInterface } from "node:readline/promises";

export async function pauseForUser(
  message = "Complete any browser verification, then press Enter to continue.",
) {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    await readline.question(`${message}\n`);
  } finally {
    readline.close();
  }
}

export async function keepBrowserOpen(
  message = "Browser left open for inspection. Press Enter here when you are done.",
) {
  // Do not close the browser from this helper. The whole point of the headed
  // path is to leave DevTools, screenshots, and manual DOM/CSS copying available
  // until the user or agent explicitly ends the session.
  await pauseForUser(message);
}
