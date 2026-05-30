import { describe, expect, test } from "bun:test";

async function runTool(args: string[]) {
  const proc = Bun.spawn(["bun", "run", "tool/cli.ts", ...args], {
    cwd: `${import.meta.dir}/..`,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

async function runUtilsCli(args: string[]) {
  const proc = Bun.spawn(["bun", "run", "package/utils/bin/cli.ts", ...args], {
    cwd: `${import.meta.dir}/..`,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

describe("repo tool CLI schema", () => {
  test("rejects unknown service commands before handlers run", async () => {
    const result = await runTool(["service", "wat"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toContain("wat");
  });

  test("rejects unknown service options before handlers run", async () => {
    const result = await runTool(["service", "source", "verify", "--wat"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toContain("wat");
  });

  test("rejects invalid factory enum options before handlers run", async () => {
    const result = await runTool(["factory", "--only=nope"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toContain("--only");
  });

  test("package utils CLI uses the repo tool schema", async () => {
    const result = await runUtilsCli(["factory", "--only=nope"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toContain("--only");
  });
});
