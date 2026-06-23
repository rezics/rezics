import { Config, Effect } from "effect";

export default Config.all({
  backend: Config.all({
    url: Config.url("BACKEND_URL").pipe(Config.withDefault(undefined)),
  }),
}).pipe(Effect.runSync);
