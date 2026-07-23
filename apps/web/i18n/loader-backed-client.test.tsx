import { resources } from "@rezics/i18n/resources";
import { create, defineResources } from "native-i18n";
import { create as createClient } from "native-i18n/react/client";
import { Suspense } from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const initialTranslation = await create(resources).getTranslation("ui", ["zh-Hant"]);
const { TranslationProvider, useTranslation } = createClient(resources);
const loadShell = vi.fn(async () => ({ title: "Shell" }));
const loadFeature = vi.fn(async () => ({ title: "Feature" }));
const cacheTestResources = defineResources({
	fallbackLocale: "en",
	loaders: {
		en: {
			shell: loadShell,
			feature: loadFeature,
		},
	},
});
const cacheTestInitial = await create(cacheTestResources).getTranslation("shell", ["en"]);
const cacheTestClient = createClient(cacheTestResources);
loadShell.mockClear();

function UnseededNamespaceProbe() {
	const { t } = useTranslation(["ui", "zones"]);
	return <p>{`${t.ui.save} / ${t.zones.navigation}`}</p>;
}

function ConcurrentNamespaceProbe() {
	const { t } = cacheTestClient.useTranslation(["shell", "feature"]);
	return <p>{`${t.shell.title} / ${t.feature.title}`}</p>;
}

describe("loader-backed i18n client", () => {
	it("loads a namespace omitted from the server snapshot", async () => {
		const stream = await renderToReadableStream(
			<TranslationProvider initial={initialTranslation.snapshot}>
				<Suspense fallback={null}>
					<UnseededNamespaceProbe />
				</Suspense>
			</TranslationProvider>,
		);
		await stream.allReady;
		const html = await new Response(stream).text();

		expect(html).toContain("儲存 / 專區導覽");
	});

	it("deduplicates concurrent loads and reuses the server seed", async () => {
		const stream = await renderToReadableStream(
			<cacheTestClient.TranslationProvider initial={cacheTestInitial.snapshot}>
				<Suspense fallback={null}>
					<ConcurrentNamespaceProbe />
					<ConcurrentNamespaceProbe />
				</Suspense>
			</cacheTestClient.TranslationProvider>,
		);
		await stream.allReady;
		const html = await new Response(stream).text();

		expect(html.match(/Shell \/ Feature/g)).toHaveLength(2);
		expect(loadShell).not.toHaveBeenCalled();
		expect(loadFeature).toHaveBeenCalledOnce();
	});
});
