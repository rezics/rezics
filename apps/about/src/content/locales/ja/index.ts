import common from "./common";
import components from "./components";
import home from "./home";
import products from "./products";

const content = { common, components, home, products } satisfies typeof import("../en").default;

export default content;
