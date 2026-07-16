import meta from "./meta";
import labels from "./labels";
import Lead from "./lead.md";

const content = {
	meta,
	labels,
	Lead,
} satisfies typeof import("../../../en/products/directory").default;

export default content;
