import Permission from "contract/router/Permission";
import { setup } from "./setup";

export default setup(({ gel, tsr }) => tsr.router(Permission, {}));
