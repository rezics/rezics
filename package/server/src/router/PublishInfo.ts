import PublishInfo from "contract/router/PublishInfo";
import { setup } from "./setup";

export default setup(({ gel, tsr }) => tsr.router(PublishInfo, {}));
