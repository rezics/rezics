import { describe, expect, test } from "bun:test";

const REPO_ROOT = `${import.meta.dir}/../..`;

async function runTool(args: string[]) {
  const proc = Bun.spawn(["bun", "run", "tool/bin/tool.ts", ...args], {
    cwd: REPO_ROOT,
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
    cwd: REPO_ROOT,
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

  test("standalone service CLI uses the service schema", async () => {
    const proc = Bun.spawn(["bun", "run", "tool/bin/service.ts", "wat"], {
      cwd: REPO_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode).not.toBe(0);
    expect(stderr + stdout).toContain("wat");
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

  test("seed kebab-case subcommands are addressable", async () => {
    const result = await runTool(["seed", "reset-root", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr + result.stdout).toContain("reset-root");
  });

  test("seed root command does not prompt without a TTY", async () => {
    const result = await runTool(["seed"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toContain(
      "Interactive seed workflow requires a TTY",
    );
  });
});
