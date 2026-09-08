"use client";
import { useReadMusicDetail, type ReadMusicDetailStatus200 } from "@rezics/openapi-tanstack-query";
import { Badge, QueryFailure, QueryPending } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/i18n/client";
import { CatalogResourcePage } from "@/features/catalog/catalog-resource-page";
import { MusicMetadata } from "../components/music-metadata";
import { MusicReleaseMedia } from "../components/music-release-media";
import { MusicHistory } from "../components/music-history";

export function MusicPage({ id }: { id: string }) {
	const query = useReadMusicDetail({ path: { id } });
	const cache = useQueryClient();
	const refresh = async () => {
		await Promise.all([
			cache.invalidateQueries({ queryKey: [{ url: "/api/v1/catalog/music/:id", params: { id } }] }),
			cache.invalidateQueries({
				queryKey: [{ url: "/api/v1/catalog/music/:id/media", params: { id } }],
			}),
			cache.invalidateQueries({
				queryKey: [{ url: "/api/v1/catalog/music/:id/media/:mediumId/tracks", params: { id } }],
			}),
			cache.invalidateQueries({
				queryKey: [{ url: "/api/v1/catalog/music/:id/history", params: { id } }],
			}),
			cache.invalidateQueries({
				queryKey: [{ url: "/api/v1/catalog/resources/:owner/:id", params: { owner: "music", id } }],
			}),
		]);
	};
	return (
		<CatalogResourcePage reference={{ owner: "music", id }}>
			{query.isPending ? (
				<QueryPending />
			) : query.isError ? (
				<QueryFailure error={query.error} retry={() => void query.refetch()} />
			) : (
				<MusicDetail detail={query.data} refresh={refresh} />
			)}
		</CatalogResourcePage>
	);
}
function MusicDetail({
	detail,
	refresh,
}: {
	detail: ReadMusicDetailStatus200;
	refresh: () => Promise<void>;
}) {
	const { t } = useTranslation(["units"]);
	const component =
		detail.kind === "release"
			? "music_release"
			: detail.kind === "recording"
				? "music_recording"
				: detail.kind === "work"
					? "music_work"
					: detail.kind === "release_group"
						? "music_release_group"
						: null;
	return (
		<div className="grid gap-5">
			<div>
				<Badge>{t.units.nativeMusic[detail.kind]}</Badge>
			</div>
			{detail.credit ? <p>{detail.credit}</p> : null}
			<MusicMetadata key={`${detail.id}:${detail.revision}`} detail={detail} refresh={refresh} />
			{detail.canEdit && detail.headId && component ? (
				<MusicHistory
					id={detail.id}
					component={component}
					componentKey={detail.id}
					expectedRevision={detail.revision}
					expectedHeadId={detail.headId}
					refresh={refresh}
				/>
			) : null}
			{detail.kind === "release" ? (
				<MusicReleaseMedia key={detail.id} detail={detail} refresh={refresh} />
			) : null}
			{detail.kind === "work" && detail.languages.length ? (
				<p>{detail.languages.join(", ")}</p>
			) : null}
			{detail.kind === "release_candidate" ? (
				<ol className="grid gap-2">
					{detail.tracks.map((track) => (
						<li key={track.id}>
							{track.position}. {track.name}
						</li>
					))}
				</ol>
			) : null}
		</div>
	);
}
