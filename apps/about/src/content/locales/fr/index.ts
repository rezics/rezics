import common from "./common";
import components from "./components";
import contact from "./contact";
import home from "./home";
import products from "./products";

const content = {
	common,
	components,
	contact,
	home,
	products,
} satisfies typeof import("../en").default;

export default content;
