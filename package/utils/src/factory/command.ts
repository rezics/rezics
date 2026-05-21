export interface FactoryCliFlags {
  preset?: string;
  planFile?: string;
  only?: string;
  meiliMode?: string;
  scenarios: string[];
  allScenarios: boolean;
  noScenarios: boolean;
  manifestFormat?: string;
  noInteractive: boolean;
  unknown: string[];
}

export function parseFactoryArgs(argv: string[]): FactoryCliFlags {
  const flags: FactoryCliFlags = {
    scenarios: [],
    allScenarios: false,
    noScenarios: false,
    noInteractive: false,
    unknown: [],
  };
  for (const arg of argv) {
    if (arg === "--no-interactive") {
      flags.noInteractive = true;
    } else if (arg === "--all-scenarios") {
      flags.allScenarios = true;
    } else if (arg === "--no-scenarios") {
      flags.noScenarios = true;
    } else if (arg.startsWith("--preset=")) {
      flags.preset = arg.slice("--preset=".length);
    } else if (arg.startsWith("--plan-file=")) {
      flags.planFile = arg.slice("--plan-file=".length);
    } else if (arg.startsWith("--only=")) {
      flags.only = arg.slice("--only=".length);
    } else if (arg.startsWith("--meili=")) {
      flags.meiliMode = arg.slice("--meili=".length);
    } else if (arg.startsWith("--scenario=")) {
      flags.scenarios.push(
        ...arg
          .slice("--scenario=".length)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      );
    } else if (arg.startsWith("--manifest=")) {
      flags.manifestFormat = arg.slice("--manifest=".length);
    } else if (arg.startsWith("-")) {
      flags.unknown.push(arg);
    }
  }
  return flags;
}

export async function runFactoryCommand(argv: string[]): Promise<void> {
  const { runFactory } = await import("./index");
  const flags = parseFactoryArgs(argv);

  if (flags.unknown.length > 0) {
    console.warn(`Ignoring unknown flag(s): ${flags.unknown.join(", ")}`);
  }

  const opts = {
    presetName: flags.preset,
    planFile: flags.planFile,
    noInteractive: flags.noInteractive,
    only: undefined as "echokv" | undefined,
    meiliMode: flags.meiliMode,
    scenarioNames: flags.scenarios,
    allScenarios: flags.allScenarios,
    noScenarios: flags.noScenarios,
    manifestFormat: flags.manifestFormat,
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
