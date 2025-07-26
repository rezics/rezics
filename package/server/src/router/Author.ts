import Author from "contract/router/Author";
import { setup } from "./setup";

export default setup(({ gel, tsr }) => tsr.router(Author, {}));
