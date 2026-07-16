import { getPrerenderProductsUrls } from "../../../../src/pageData.server";
export const onBeforePrerenderStart = () => getPrerenderProductsUrls();
