import { createErrorPageData } from "../../src/pageData.server";
export const data = (pageContext: { is404?: boolean }) =>
	createErrorPageData(pageContext.is404 === false ? 500 : 404);
