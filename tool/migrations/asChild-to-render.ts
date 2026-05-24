import {
  type JsxElement,
  type JsxSelfClosingElement,
  Project,
  SyntaxKind,
} from "ts-morph";

type RewriteResult = {
  file: string;
  rewrites: number;
  warnings: string[];
};

const usage = `Usage:
  bun run tool/migrations/asChild-to-render.ts [--write] <path...>

Rewrites JSX of the form:
  <Foo asChild><Bar /></Foo>

to:
  <Foo render={(props) => <Bar {...props} />} />
`;

const args = process.argv.slice(2);
const write = args.includes("--write");
const roots = args.filter((arg) => arg !== "--write");

if (roots.length === 0) {
  console.error(usage);
  process.exit(1);
}

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
  skipAddingFilesFromTsConfig: true,
});

project.addSourceFilesAtPaths(
  roots.map((root) => `${root.replace(/\/$/, "")}/**/*.{ts,tsx}`),
);

const results: RewriteResult[] = [];

for (const sourceFile of project.getSourceFiles()) {
  if (!sourceFile.getFilePath().endsWith(".tsx")) continue;

  const warnings: string[] = [];
  let rewrites = 0;

  const elements = sourceFile
    .getDescendantsOfKind(SyntaxKind.JsxElement)
    .reverse();

  for (const element of elements) {
    const opening = element.getOpeningElement();
    const asChildAttr = opening
      .getAttributes()
      .find(
        (attr) =>
          attr.getKind() === SyntaxKind.JsxAttribute &&
          attr.getText() === "asChild",
      );

    if (!asChildAttr) continue;

    const line = sourceFile.getLineAndColumnAtPos(asChildAttr.getStart()).line;
    const children = element.getJsxChildren().filter((child) => {
      if (child.getKind() === SyntaxKind.JsxText)
        return child.getText().trim().length > 0;
      return true;
    });

    if (children.length !== 1) {
      warnings.push(
        `${sourceFile.getBaseName()}:${line} skipped: expected exactly one JSX child, found ${children.length}`,
      );
      continue;
    }

    const child = children[0]!;
    if (
      child.getKind() !== SyntaxKind.JsxElement &&
      child.getKind() !== SyntaxKind.JsxSelfClosingElement
    ) {
      warnings.push(
        `${sourceFile.getBaseName()}:${line} skipped: child is not a JSX element`,
      );
      continue;
    }

    const childText = withPropsSpread(
      child as JsxElement | JsxSelfClosingElement,
    );
    if (!childText) {
      warnings.push(
        `${sourceFile.getBaseName()}:${line} skipped: child already has a props spread`,
      );
      continue;
    }

    const tagName = opening.getTagNameNode().getText();
    const attrs = opening
      .getAttributes()
      .filter((attr) => attr !== asChildAttr)
      .map((attr) => attr.getText());
    attrs.push(`render={(props) => ${childText}}`);
    element.replaceWithText(`<${tagName} ${attrs.join(" ")} />`);
    rewrites += 1;
  }

  if (rewrites > 0 || warnings.length > 0) {
    results.push({
      file: sourceFile.getFilePath(),
      rewrites,
      warnings,
    });
  }
}

if (write) {
  await project.save();
}

for (const result of results) {
  console.log(
    `${write ? "updated" : "dry-run"} ${result.file}: ${result.rewrites} rewrite(s)`,
  );
  for (const warning of result.warnings) {
    console.warn(`  warning: ${warning}`);
  }
}

const totalRewrites = results.reduce((sum, result) => sum + result.rewrites, 0);
const totalWarnings = results.reduce(
  (sum, result) => sum + result.warnings.length,
  0,
);

console.log(
  `${write ? "wrote" : "would write"} ${totalRewrites} rewrite(s), ${totalWarnings} warning(s)`,
);

function withPropsSpread(
  child: JsxElement | JsxSelfClosingElement,
): string | null {
  if (child.getText().includes("{...props}")) return null;

  if (child.getKind() === SyntaxKind.JsxSelfClosingElement) {
    return child.getText().replace(/\s*\/>$/, " {...props} />");
  }

  const opening = (child as JsxElement).getOpeningElement();
  const start = opening.getStart() - child.getStart();
  const end = opening.getEnd() - child.getStart();
  const text = child.getText();
  const openingText = text.slice(start, end);
  const nextOpeningText = openingText.replace(/>$/, " {...props}>");
  return `${text.slice(0, start)}${nextOpeningText}${text.slice(end)}`;
}
