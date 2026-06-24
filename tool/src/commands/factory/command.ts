import * as p from "@clack/prompts";
import { define } from "gunshi";
import { repeatedCsv } from "../../cli/values";

type FactoryCommandOptions = {
  presetName?: string;
  planFile?: string;
  only?: "echokv";
  meiliMode?: "init-and-sync" | "skip";
  scenarioNames?: string[];
  allScenarios?: boolean;
  noScenarios?: boolean;
  manifestFormat?: "human" | "json" | "both" | "none";
  noInteractive?: boolean;
};

type FactoryCliValues = {
  preset?: string;
  planFile?: string;
  only?: FactoryCommandOptions["only"];
  meili?: FactoryCommandOptions["meiliMode"];
  scenario?: string | string[];
  allScenarios?: boolean;
  noScenarios?: boolean;
  manifest?: FactoryCommandOptions["manifestFormat"];
  noInteractive?: boolean;
};

function factoryOptionsFromValues(
  values: Readonly<FactoryCliValues>,
): FactoryCommandOptions {
  return {
    presetName: values.preset,
    planFile: values.planFile,
    only: values.only,
    meiliMode: values.meili,
    scenarioNames: repeatedCsv(values.scenario),
    allScenarios: Boolean(values.allScenarios),
    noScenarios: Boolean(values.noScenarios),
    manifestFormat: values.manifest,
    noInteractive: Boolean(values.noInteractive),
  };
}

export const factoryCommand = define({
  name: "factory",
  description: "Run factory seed data workflows.",
  args: {
    preset: { type: "string", description: "Factory preset name." },
    planFile: {
      type: "string",
      description: "Path to a factory seed plan file.",
    },
    only: {
      type: "enum",
      choices: ["echokv"],
      description: "Run one supported special factory target.",
    },
    meili: {
      type: "enum",
      choices: ["init-and-sync", "skip"],
      description: "Meilisearch handling mode.",
    },
    scenario: {
      type: "string",
      multiple: true,
      description: "Scenario name. Repeat or comma-separate.",
    },
    allScenarios: {
      type: "boolean",
      description: "Run all factory scenarios.",
      conflicts: "noScenarios",
    },
    noScenarios: {
      type: "boolean",
      description: "Skip factory scenarios.",
      conflicts: "allScenarios",
    },
    manifest: {
      type: "enum",
      choices: ["human", "json", "both", "none"],
      description: "Special target manifest output format.",
    },
    noInteractive: {
      type: "boolean",
      description: "Skip interactive selection and confirmation.",
    },
  },
  toKebab: true,
  run: async (ctx) => {
    p.intro("Rezics Factory");
    const { runFactoryCommand } = await import(
      "../../../../packages/utils/src/factory/command"
    );
    await runFactoryCommand(
      factoryOptionsFromValues(ctx.values as FactoryCliValues),
    );
    p.outro("Done!");
  },
});
