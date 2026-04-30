import { type RunFactoryOptions, runFactory } from "./index";

export interface FactoryCliFlags {
  preset?: string;
  planFile?: string;
  only?: string;
  noInteractive: boolean;
  unknown: string[];
}

export function parseFactoryArgs(argv: string[]): FactoryCliFlags {
  const flags: FactoryCliFlags = { noInteractive: false, unknown: [] };
  for (const arg of argv) {
    if (arg === "--no-interactive") {
      flags.noInteractive = true;
    } else if (arg.startsWith("--preset=")) {
      flags.preset = arg.slice("--preset=".length);
    } else if (arg.startsWith("--plan-file=")) {
      flags.planFile = arg.slice("--plan-file=".length);
    } else if (arg.startsWith("--only=")) {
      flags.only = arg.slice("--only=".length);
    } else if (arg.startsWith("-")) {
      flags.unknown.push(arg);
    }
  }
  return flags;
}

export async function runFactoryCommand(argv: string[]): Promise<void> {
  const flags = parseFactoryArgs(argv);

  if (flags.unknown.length > 0) {
    console.warn(`Ignoring unknown flag(s): ${flags.unknown.join(", ")}`);
  }

  const opts: RunFactoryOptions = {
    presetName: flags.preset,
    planFile: flags.planFile,
    noInteractive: flags.noInteractive,
  };

  if (flags.only) {
    if (flags.only !== "echokv") {
      console.error(`Unknown --only value "${flags.only}". Supported: echokv.`);
      process.exit(2);
    }
    opts.only = flags.only;
  }

  await runFactory(opts);
}
