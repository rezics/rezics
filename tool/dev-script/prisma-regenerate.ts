import path from "node:path";

const SCRIPT_DIR = path.dirname(Bun.main);
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..", "..");

const packages = ["server", "auth", "notify", "reaction"];

console.log("Regenerating Prisma clients...\n");

let hasError = false;

for (const pkg of packages) {
  const cwd = path.join(ROOT_DIR, "package", pkg);
  console.log(`→ @rezics/${pkg}`);

  const proc = Bun.spawn(["bunx", "prisma", "generate"], {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    console.error(`  ✗ Failed for @rezics/${pkg}\n`);
    hasError = true;
  } else {
    console.log(`  ✓ Done\n`);
  }
}

if (hasError) {
  console.error("Some packages failed to regenerate.");
  process.exit(1);
} else {
  console.log("All Prisma clients regenerated successfully.");
}
