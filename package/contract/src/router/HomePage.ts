import c from "./c";
import { HomePageSchema } from "../schema/HomePage";

export default c.router({
    get: {
        method: "GET",
        path: "/home",
        responses: { 200: HomePageSchema },
    },
});
