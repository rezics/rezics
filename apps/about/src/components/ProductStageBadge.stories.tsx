import preview from "../../.storybook/preview";
import { getSiteCopy } from "../content/locales";
import { ProductStageBadge } from "./ProductStageBadge";

const meta = preview.meta({ component: ProductStageBadge, tags: ["ai-generated"] });
export default meta;
export const Available = meta.story({
	args: { stage: "available", label: getSiteCopy("en").products.stage.labels.available },
});
export const Development = meta.story({
	args: { stage: "development", label: getSiteCopy("en").products.stage.labels.development },
});
export const Planned = meta.story({
	args: { stage: "planned", label: getSiteCopy("en").products.stage.labels.planned },
});
