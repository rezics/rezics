import { define } from "gunshi";
import { ensureLocalDatabases } from "./ensure";

export const dbCommand = define({
  name: "db",
  description: "Manage local repo databases.",
  subCommands: {
    ensure: define({
      name: "ensure",
      description:
        "Create managed local databases idempotently from tool config.",
      run: () => ensureLocalDatabases(),
    }),
  },
});
