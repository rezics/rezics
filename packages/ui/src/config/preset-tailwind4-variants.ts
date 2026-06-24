import { definePreset, escapeSelector } from "unocss";

function prefixedAttributeSelector(prefix: "aria" | "data", value: string) {
  if (!value.startsWith("[") || !value.endsWith("]")) {
    return `[${prefix}-${value}]`;
  }

  const inner = value.slice(1, -1);
  const [name, ...rest] = inner.split("=");
  if (rest.length === 0) {
    return `[${prefix}-${name}]`;
  }

  return `[${prefix}-${name}=${rest.join("=")}]`;
}

function namedGroupSelector(name?: string) {
  return `.${escapeSelector(name ? `group/${name}` : "group")}`;
}

function arbitrarySelector(selector: string, value: string) {
  if (value.includes("&")) {
    return value.replaceAll("&", selector);
  }

  if (value.startsWith(">")) {
    return `${selector}${value}`;
  }

  if (
    value.startsWith(".") ||
    value.startsWith("#") ||
    value.startsWith(":") ||
    value.startsWith("[")
  ) {
    return `${selector}${value}`;
  }

  return `${selector} ${value}`;
}

function splitVariantSegments(matcher: string) {
  const segments: string[] = [];
  let start = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  let quote: string | undefined;

  for (let i = 0; i < matcher.length; i += 1) {
    const char = matcher[i];
    const previous = matcher[i - 1];

    if (quote) {
      if (char === quote && previous !== "\\") {
        quote = undefined;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (char === "[") {
      bracketDepth += 1;
      continue;
    }

    if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (char === "(") {
      parenDepth += 1;
      continue;
    }

    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (char === ":" && bracketDepth === 0 && parenDepth === 0) {
      segments.push(matcher.slice(start, i));
      start = i + 1;
    }
  }

  segments.push(matcher.slice(start));
  return segments;
}

function isSimpleTailwindArbitrarySelector(segment: string) {
  return /^\[(?:[.#:]?[\w-]+|[a-z][\w-]*(?::[\w-]+)?)\]$/.test(segment);
}

function preprocessTailwind4Variants(matcher: string) {
  const segments = splitVariantSegments(matcher);
  if (segments.length < 2) {
    return matcher;
  }

  const processed: string[] = [];
  let changed = false;

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const next = segments[i + 1];
    const isVariantSegment = i < segments.length - 1;

    if (
      isVariantSegment &&
      (segment === "*" || segment === "**") &&
      next?.startsWith("[")
    ) {
      processed.push(
        `tailwind4-${segment === "*" ? "child" : "descendant"}-${next}`,
      );
      i += 1;
      changed = true;
      continue;
    }

    if (isVariantSegment && segment === "**" && !next?.startsWith("data-[")) {
      processed.push("tailwind4-descendant-all");
      changed = true;
      continue;
    }

    if (isVariantSegment && isSimpleTailwindArbitrarySelector(segment)) {
      processed.push(`tailwind4-selector-${segment}`);
      changed = true;
      continue;
    }

    processed.push(segment);
  }

  return changed ? processed.join(":") : matcher;
}

export const presetTailwind4Variants = definePreset(() => ({
  name: "rezics-tailwind4-variants",
  preprocess: [preprocessTailwind4Variants],
  variants: [
    {
      name: "tailwind4-child-arbitrary",
      match(matcher: string) {
        const match = matcher.match(/^tailwind4-child-(\[.+\]):(.+)$/);
        if (!match) {
          return;
        }

        const [, value, rest] = match;
        const child = value.slice(1, -1);
        return {
          matcher: rest,
          order: 10,
          selector: (selector: string) => `${selector} > ${child}`,
        };
      },
    },
    {
      name: "tailwind4-descendant-arbitrary",
      match(matcher: string) {
        const match = matcher.match(/^tailwind4-descendant-(\[.+\]):(.+)$/);
        if (!match) {
          return;
        }

        const [, value, rest] = match;
        const descendant = value.slice(1, -1);
        return {
          matcher: rest,
          order: 10,
          selector: (selector: string) => `${selector} ${descendant}`,
        };
      },
    },
    {
      name: "tailwind4-descendant-all",
      match(matcher: string) {
        const match = matcher.match(/^tailwind4-descendant-all:(.+)$/);
        if (!match) {
          return;
        }

        const [, rest] = match;
        return {
          matcher: rest,
          order: 10,
          selector: (selector: string) => `${selector} *`,
        };
      },
    },
    {
      name: "tailwind4-arbitrary-selector",
      match(matcher: string) {
        const match = matcher.match(/^tailwind4-selector-(\[.+\]):(.+)$/);
        if (!match) {
          return;
        }

        const [, value, rest] = match;
        const target = value.slice(1, -1);
        return {
          matcher: rest,
          order: 10,
          selector: (selector: string) => arbitrarySelector(selector, target),
        };
      },
    },
    {
      name: "tailwind4-data-shorthand",
      match(matcher: string) {
        const match = matcher.match(/^data-([a-z-]+):(.+)$/);
        if (!match) {
          return;
        }

        const [, name, rest] = match;
        return {
          matcher: rest,
          order: -20,
          selector: (selector: string) => `${selector}[data-${name}]`,
        };
      },
    },
    {
      name: "tailwind4-aria-shorthand",
      match(matcher: string) {
        const match = matcher.match(/^aria-([a-z-]+):(.+)$/);
        if (!match) {
          return;
        }

        const [, name, rest] = match;
        return {
          matcher: rest,
          order: -20,
          selector: (selector: string) => `${selector}[aria-${name}="true"]`,
        };
      },
    },
    {
      name: "tailwind4-not-data-arbitrary",
      match(matcher: string) {
        const match = matcher.match(/^not-data-(\[[^\]]+\]):(.+)$/);
        if (!match) {
          return;
        }

        const [, value, rest] = match;
        const attribute = prefixedAttributeSelector("data", value);
        return {
          matcher: rest,
          order: -20,
          selector: (selector: string) => `${selector}:not(${attribute})`,
        };
      },
    },
    {
      name: "tailwind4-not-aria-arbitrary",
      match(matcher: string) {
        const match = matcher.match(/^not-aria-(\[[^\]]+\]):(.+)$/);
        if (!match) {
          return;
        }

        const [, value, rest] = match;
        const attribute = prefixedAttributeSelector("aria", value);
        return {
          matcher: rest,
          order: -20,
          selector: (selector: string) => `${selector}:not(${attribute})`,
        };
      },
    },
    {
      name: "tailwind4-group-data-shorthand",
      match(matcher: string) {
        const match = matcher.match(
          /^group-data-([a-z-]+)(?:\/([^:]+))?:(.+)$/,
        );
        if (!match) {
          return;
        }

        const [, name, groupName, rest] = match;
        return {
          matcher: rest,
          order: 20,
          selector: (selector: string) =>
            `${namedGroupSelector(groupName)}[data-${name}] ${selector}`,
        };
      },
    },
    {
      name: "tailwind4-group-has-data-arbitrary",
      match(matcher: string) {
        const match = matcher.match(
          /^group-has-data-(\[[^\]]+\])(?:\/([^:]+))?:(.+)$/,
        );
        if (!match) {
          return;
        }

        const [, value, groupName, rest] = match;
        const attribute = prefixedAttributeSelector("data", value);
        return {
          matcher: rest,
          order: 20,
          selector: (selector: string) =>
            `${namedGroupSelector(groupName)}:has(${attribute}) ${selector}`,
        };
      },
    },
  ],
}));
