export * from "./deprecated/router/index";
export * as Schema from "./deprecated/schema/index";

import { Router } from "./deprecated/router/index";
import c from "./deprecated/router/c";
export default c.router(Router);
