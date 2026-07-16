import { getPrerenderHomeUrls } from "../../../src/pageData.server";
export const onBeforePrerenderStart = () => getPrerenderHomeUrls();
