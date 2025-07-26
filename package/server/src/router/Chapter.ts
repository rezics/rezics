import Chapter from "contract/router/Chapter";
import { setup } from "./setup";

export default setup(({ gel, tsr }) => tsr.router(Chapter, {}));
