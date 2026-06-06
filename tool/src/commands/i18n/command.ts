import { define } from "gunshi";
import { runRepoScript } from "../../cli/command-runner";

export const i18nCommand = define({
  name: "i18n",
  description: "Run i18n maintenance commands.",
  subCommands: {
    check: define({
      name: "check",
      description: "Validate frontend i18n catalog usage.",
      run: () => runRepoScript(["tool/src/commands/i18n/check.ts"]),
    }),
    missing: define({
      name: "missing",
      description: "Report missing i18n keys.",
      run: () => runRepoScript(["tool/src/commands/i18n/missing.ts"]),
    }),
    dedup: define({
      name: "dedup",
      description: "Deduplicate i18n catalog entries.",
      run: () => runRepoScript(["tool/src/commands/i18n/dedup.ts"]),
    }),
    analyzeDuplicates: define({
      name: "analyze-duplicates",
      description: "Analyze duplicate i18n message values.",
      run: () =>
        runRepoScript(["tool/src/commands/i18n/analyze-duplicates.ts"]),
    }),
  },
});
