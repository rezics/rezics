import type { CommandContext } from "gunshi";

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function assertKnownCliInput(ctx: Readonly<CommandContext>): void {
  const args = Object.entries(ctx.args ?? {});
  const knownOptions = new Set(["help", "h", "version", "v"]);
  for (const [name, schema] of args) {
    if (schema.type === "positional") {
      continue;
    }
    knownOptions.add(name);
    knownOptions.add(kebab(name));
    if (schema.short) {
      knownOptions.add(schema.short);
    }
    if (schema.type === "boolean") {
      knownOptions.add(`no-${name}`);
      knownOptions.add(`no-${kebab(name)}`);
    }
  }

  for (const token of ctx.tokens) {
    if (token.kind === "option" && !knownOptions.has(token.name ?? "")) {
      throw new Error(`Unknown option: ${token.rawName}`);
    }
  }

  const positionalArgs = args.filter(
    ([, schema]) => schema.type === "positional",
  );
  const allowsManyPositionals = positionalArgs.some(
    ([, schema]) => schema.multiple,
  );
  const allowedPositionals = allowsManyPositionals
    ? Number.POSITIVE_INFINITY
    : positionalArgs.length;
  const extraPositionals =
    ctx.tokens.filter((token) => token.kind === "positional").length -
    ctx.commandPath.length;

  if (extraPositionals > allowedPositionals) {
    const unknown = ctx.positionals[ctx.commandPath.length];
    throw new Error(`Unknown command or argument: ${unknown}`);
  }
}
