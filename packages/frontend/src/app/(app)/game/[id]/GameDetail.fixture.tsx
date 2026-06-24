import { mockGame } from "@/__cosmos__/mock-data";
import { Suspense } from "react";
import { GameDetailContent } from "./content";

function GameFixture({ id }: { readonly id: string }) {
  return (
    <div className="p-4 sm:p-6">
      <Suspense fallback={<div>Loading...</div>}>
        <GameDetailContent paramsPromise={Promise.resolve({ id })} />
      </Suspense>
    </div>
  );
}

export default {
  Default: <GameFixture id={mockGame().unitId} />,
  AltGame: <GameFixture id="game-002" />,
  NumericId: <GameFixture id="982451653" />,
  LongId: <GameFixture id="game-with-a-long-imported-storefront-id-and-edition-suffix" />,
  NarrowLongId: (
    <div className="max-w-80">
      <GameFixture id="unbrokengameidunbrokengameidunbrokengameidunbrokengameid" />
    </div>
  ),
};
