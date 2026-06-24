import { GameDetailContent } from "./content";
import { Suspense } from "react";

export default {
  Default: (
    <Suspense fallback={<div>Loading...</div>}>
      <GameDetailContent paramsPromise={Promise.resolve({ id: "game-001" })} />
    </Suspense>
  ),
  AltGame: (
    <Suspense fallback={<div>Loading...</div>}>
      <GameDetailContent paramsPromise={Promise.resolve({ id: "game-002" })} />
    </Suspense>
  ),
};
