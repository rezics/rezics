import { PRISMA_PACKAGES } from "./packages";
import { runPrisma } from "./runner";

console.log("Regenerating Prisma clients...\n");

let hasError = false;

for (const pkg of PRISMA_PACKAGES) {
  console.log(`-> @rezics/${pkg}`);

  const result = await runPrisma(pkg, ["generate"], { stdin: "ignore" });

  if (result === "fail") {
    console.error(`  x Failed for @rezics/${pkg}\n`);
    hasError = true;
  } else {
    console.log(`  Done\n`);
  }
}

if (hasError) {
  console.error("Some packages failed to regenerate.");
  process.exit(1);
} else {
  console.log("All Prisma clients regenerated successfully.");
}
