import type { ProductId } from "../../../productRegistry";
import common from "./common";
import directory from "./directory";
import catalog from "./catalog";
import book from "./book";
import gamebook from "./gamebook";
import media from "./media";
import software from "./software";
import series from "./series";
import release from "./release";
import post from "./post";
import wiki from "./wiki";
import picture from "./picture";
import review from "./review";
import shelf from "./shelf";
import library from "./library";
import realm from "./realm";
import zone from "./zone";
import comment from "./comment";
import score from "./score";
import contentStructure from "./content-structure";
import history from "./history";
import editor from "./editor";
import feed from "./feed";
import tags from "./tags";
import progress from "./progress";
import entityAttribution from "./entity-attribution";
import apiOauth from "./api-oauth";

const byId = {
	catalog: catalog,
	book: book,
	gamebook: gamebook,
	media: media,
	software: software,
	series: series,
	release: release,
	post: post,
	wiki: wiki,
	picture: picture,
	review: review,
	shelf: shelf,
	library: library,
	realm: realm,
	zone: zone,
	comment: comment,
	score: score,
	"content-structure": contentStructure,
	history: history,
	editor: editor,
	feed: feed,
	tags: tags,
	progress: progress,
	"entity-attribution": entityAttribution,
	"api-oauth": apiOauth,
} satisfies Record<ProductId, typeof book>;

const content = { common, directory, byId };

export default content;
