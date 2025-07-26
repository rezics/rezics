export * from "./router/index";
export * as Schema from "./schema/index";

import { Router } from "./router/index";
import c from "./router/c";
export default c.router(Router);
