import { classifyUrl } from "@rezics/contract";
import type MarkdownIt from "markdown-it";

export function linkProtectionPlugin(md: MarkdownIt): void {
  const defaultRender =
    md.renderer.rules.link_open ||
    ((tokens, idx, options, _env, self) =>
      self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const hrefIndex = token.attrIndex("href");

    if (hrefIndex >= 0) {
      const href = token.attrs![hrefIndex][1];
      const { kind, href: resolvedHref } = classifyUrl(href);

      token.attrs![hrefIndex][1] = resolvedHref || href;
      token.attrSet("data-link-kind", kind);

      if (kind === "external") {
        token.attrSet("rel", "noopener noreferrer");
        token.attrSet("target", "_blank");
      } else if (kind === "rezics") {
        token.attrSet("rel", "noopener noreferrer");
      }
    }

    return defaultRender(tokens, idx, options, env, self);
  };

  const defaultCloseRender =
    md.renderer.rules.link_close ||
    ((tokens, idx, options, _env, self) =>
      self.renderToken(tokens, idx, options));

  md.renderer.rules.link_close = (tokens, idx, options, env, self) => {
    const openIdx = findMatchingOpen(tokens, idx);
    if (openIdx >= 0) {
      const openToken = tokens[openIdx];
      const kindAttr = openToken.attrGet("data-link-kind");
      if (kindAttr === "blocked") {
        return "</span>";
      }
    }
    return defaultCloseRender(tokens, idx, options, env, self);
  };

  const origOpen = md.renderer.rules.link_open;
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const kindAttr = token.attrGet("data-link-kind");
    if (kindAttr === "blocked") {
      token.tag = "span";
      token.attrSet("href", "");
      const attrs =
        token.attrs?.filter(
          ([key]) => key !== "href" && key !== "target" && key !== "rel",
        ) ?? [];
      token.attrs = attrs;
      return self.renderToken(tokens, idx, options);
    }
    return origOpen!(tokens, idx, options, env, self);
  };
}

function findMatchingOpen(
  tokens: { type: string; nesting: number }[],
  closeIdx: number,
): number {
  let depth = 0;
  for (let i = closeIdx; i >= 0; i--) {
    if (tokens[i].type === "link_close") depth++;
    if (tokens[i].type === "link_open") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
