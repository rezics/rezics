import meta from "./meta";
import labels from "./labels";
import Hero from "./sections/hero.md";
import Stage from "./sections/stage.md";
import Products from "./sections/products.md";
import Platform from "./sections/platform.md";
import Composition from "./sections/composition.md";
import History from "./sections/history.md";
import OpenSource from "./sections/openSource.md";
import HistoryBook from "./sections/historyBook.md";
import HistoryPost from "./sections/historyPost.md";
import HistoryZone from "./sections/historyZone.md";
import OpenOutline from "./sections/openOutline.md";
import OpenApi from "./sections/openApi.md";
import OpenGithub from "./sections/openGithub.md";

const content = {
	meta,
	labels,
	sections: { Hero, Stage, Products, Platform, Composition, History, OpenSource },
	historyConsumers: { book: HistoryBook, post: HistoryPost, zone: HistoryZone },
	openDescriptions: { outline: OpenOutline, api: OpenApi, github: OpenGithub },
} satisfies typeof import("../../en/home/index").default;

export default content;
