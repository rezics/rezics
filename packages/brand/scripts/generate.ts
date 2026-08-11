import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "src");
const dist = join(root, "dist");

const Sources = ["logo", "mark", "app-icon", "avatar", "social-card"] as const;

const Pngs = [
	["logo", 1400],
	["logo", 2800, "logo@2x"],
	["logo-dark", 1400],
	["logo-dark", 2800, "logo-dark@2x"],
	["mark", 512],
	["mark", 1024, "mark@2x"],
	["app-icon", 180, "app-icon-180"],
	["app-icon", 192, "app-icon-192"],
	["app-icon", 512, "app-icon-512"],
	["app-icon", 1024],
	["avatar", 800],
	["avatar", 1600, "avatar@2x"],
	["social-card", 1200],
	["social-card-dark", 1200],
] as const;

function isMissingExecutable(error: unknown) {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function run(command: string, args: string[]) {
	try {
		execFileSync(command, args, { stdio: "inherit" });
	} catch (error) {
		if (isMissingExecutable(error)) {
			throw new Error(`${command} is unavailable. Run this script inside the project devenv.`);
		}
		throw error;
	}
}

function requireFont(font: string) {
	let family: string;
	try {
		family = execFileSync("fc-match", ["-f", "%{family}", font], { encoding: "utf8" });
	} catch (error) {
		if (isMissingExecutable(error)) {
			throw new Error("fontconfig is unavailable. Run this script inside the project devenv.");
		}
		throw error;
	}

	if (family !== font) {
		throw new Error(`${font} is unavailable. Run this script inside the project devenv.`);
	}
}

function exportSvg(name: (typeof Sources)[number]) {
	run("inkscape", [
		join(source, `${name}.svg`),
		"--export-area-page",
		"--export-plain-svg",
		"--export-text-to-path",
		`--export-filename=${join(dist, `${name}.svg`)}`,
	]);
}

function replaceOnce(svg: string, pattern: string, replacement: string, asset: string) {
	if (!svg.includes(pattern)) throw new Error(`${asset}: expected ${JSON.stringify(pattern)}`);
	return svg.replace(pattern, replacement);
}

function derive(name: string, from: string, transforms: readonly (readonly [string, string])[]) {
	let svg = readFileSync(join(dist, `${from}.svg`), "utf8");
	for (const [pattern, replacement] of transforms) {
		svg = replaceOnce(svg, pattern, replacement, name);
	}
	writeFileSync(join(dist, `${name}.svg`), svg);
}

function exportPng(name: string, width: number, output = name) {
	run("inkscape", [
		join(dist, `${name}.svg`),
		"--export-area-page",
		"--export-type=png",
		`--export-width=${width}`,
		`--export-filename=${join(dist, `${output}.png`)}`,
	]);
}

for (const font of ["Inter Display", "Inter Variable"]) requireFont(font);

mkdirSync(dist, { recursive: true });
for (const entry of readdirSync(dist)) rmSync(join(dist, entry), { recursive: true });

for (const name of Sources) exportSvg(name);

for (const name of Sources) {
	const path = join(dist, `${name}.svg`);
	const svg = readFileSync(path, "utf8").replace(
		/(?:font-family|font-size|font-weight|font-variation-settings|-inkscape-font-specification|letter-spacing):[^;\"]*;/g,
		"",
	);
	writeFileSync(path, svg);
}

// Color variants are derived from canonical geometry, so their shapes cannot drift.
derive("logo-dark", "logo", [
	["fill:#ffffff", "fill:#121116"],
	['style="stroke-width:0.264583"', 'style="fill:#ffffff;stroke-width:0.264583"'],
]);
derive("mark-mono-dark", "mark", [['fill="url(#brand)"', 'fill="#121116"']]);
derive("mark-mono-light", "mark", [['fill="url(#brand)"', 'fill="#ffffff"']]);
derive("social-card-dark", "social-card", [
	['fill="#fff"', 'fill="#121116"'],
	['style="fill:#121116"', 'style="fill:#ffffff"'],
]);

for (const entry of readdirSync(dist).filter((name) => name.endsWith(".svg"))) {
	const svg = readFileSync(join(dist, entry), "utf8");
	if (/<(?:text|tspan)\b|font-(?:family|size|weight|variation-settings)/.test(svg)) {
		throw new Error(`${entry}: generated SVGs must not contain text or font properties.`);
	}
}

for (const [name, width, output] of Pngs) exportPng(name, width, output);
