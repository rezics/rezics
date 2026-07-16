import { getPrerenderProductUrls } from "../../../../src/pageData.server";
export const onBeforePrerenderStart = () => getPrerenderProductUrls();
