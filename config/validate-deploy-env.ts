#!/usr/bin/env bun
/**
 * Pre-deploy env validation gate.
 *
 * For a deployment unit, decrypts its SOPS secret files (the per-unit file plus
 * the shared `common.enc.env`) and asserts every secret key referenced by that
 * unit's Kamal config (`env.secret`, including per-role blocks) is present and
 * non-empty. Exits non-zero with a clear list of missing keys so the release
 * pipeline stops BEFORE `kamal deploy` mutates a running service.
 *
 * Usage:
 *   bun config/validate-deploy-env.ts <unit>
 *   bun config/validate-deploy-env.ts all
 */
import { $ } from "bun";

const UNITS = [
  "server",
  "auth",
  "notify",
  "reaction",
  "history",
  "ranking",
  "preview",
  "job-runner",
] as const;
type Unit = (typeof UNITS)[number];

/** Collect every `- KEY` line nested under any `secret:` block in a config. */
function secretKeysFromConfig(yaml: string): string[] {
  const keys = new Set<string>();
  const lines = yaml.split("\n");
  let inSecret = false;
  let secretIndent = -1;

  for (const raw of lines) {
    if (raw.trim() === "" || raw.trim().startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();

    if (/^secret:\s*$/.test(trimmed)) {
      inSecret = true;
      secretIndent = indent;
      continue;
    }
    if (inSecret) {
      if (trimmed.startsWith("- ")) {
        keys.add(trimmed.slice(2).trim());
        continue;
      }
      // Dedent or a sibling key ends the secret block.
      if (indent <= secretIndent) inSecret = false;
    }
  }
  return [...keys];
}

async function decrypt(path: string): Promise<Record<string, string>> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`missing encrypted env file: ${path}`);
  }
  const text = await $`sops --decrypt ${path}`.text();
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

async function validateUnit(unit: Unit): Promise<string[]> {
  const config = await Bun.file(`config/deploy.${unit}.yml`).text();
  const required = secretKeysFromConfig(config);

  const values: Record<string, string> = {
    ...(await decrypt("config/secrets/common.enc.env")),
    ...(await decrypt(`config/secrets/${unit}.enc.env`)),
  };

  return required.filter((key) => !values[key] || values[key].length === 0);
}

const arg = process.argv[2];
if (!arg) {
  console.error("usage: bun config/validate-deploy-env.ts <unit|all>");
  process.exit(2);
}

const targets: Unit[] =
  arg === "all" ? [...UNITS] : UNITS.includes(arg as Unit) ? [arg as Unit] : [];
if (targets.length === 0) {
  console.error(
    `unknown unit: ${arg} (expected one of ${UNITS.join(", ")}, or "all")`,
  );
  process.exit(2);
}

let failed = false;
for (const unit of targets) {
  try {
    const missing = await validateUnit(unit);
    if (missing.length > 0) {
      failed = true;
      console.error(
        `✗ ${unit}: missing/empty secrets -> ${missing.join(", ")}`,
      );
    } else {
      console.log(`✓ ${unit}: all required secrets present`);
    }
  } catch (error) {
    failed = true;
    console.error(`✗ ${unit}: ${(error as Error).message}`);
  }
}

process.exit(failed ? 1 : 0);
