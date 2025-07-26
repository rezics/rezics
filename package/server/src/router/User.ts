import { setup } from "./setup";
import User from "contract/router/User";

export default setup(({ gel, tsr }) => tsr.router(User, {}));
