const instances: Array<{ port: number; label: string }> = [
  { port: 6006, label: "Host" },
  { port: 6007, label: "ui" },
  { port: 6008, label: "editor" },
  { port: 6009, label: "folio" },
  { port: 6010, label: "admin" },
  { port: 6011, label: "app" },
];

const READY_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 500;

async function isReady(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}/iframe.html`, {
      signal: AbortSignal.timeout(800),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitAllReady(): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  const ready = new Set<number>();
  while (Date.now() < deadline) {
    await Promise.all(
      instances
        .filter((i) => !ready.has(i.port))
        .map(async (i) => {
          if (await isReady(i.port)) ready.add(i.port);
        }),
    );
    if (ready.size === instances.length) return;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    `Timed out waiting for storybooks: missing ${instances
      .filter((i) => !ready.has(i.port))
      .map((i) => `${i.label}:${i.port}`)
      .join(", ")}`,
  );
}

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

function printBanner(): void {
  const labelWidth = Math.max(...instances.map((i) => i.label.length));
  const rows = instances.map((i) => {
    const label = i.label.padEnd(labelWidth);
    const url = `http://localhost:${i.port}/`;
    const tag = "";
    return `  ${bold(label)}  ${url}${tag}`;
  });
  const lines = [
    "",
    green("✓ rezics design system — all 6 storybooks ready"),
    "",
    ...rows,
    "",
    dim("  Ctrl+C to stop. Logs from servers will print below as they happen."),
    "",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

function awaitForever(): Promise<void> {
  return new Promise(() => {});
}

export {};

await waitAllReady();
printBanner();
await awaitForever();
