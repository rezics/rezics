import { getPrerenderContactUrls } from "../../../src/pageData.server";

export const onBeforePrerenderStart = () => getPrerenderContactUrls();
