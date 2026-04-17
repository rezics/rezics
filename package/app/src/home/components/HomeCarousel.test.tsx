import type { ComponentProps } from "react";
import { useFixtureInput } from "react-cosmos/client";
import { BookCarousel } from "./HomeCarousel";

type BookCarouselProps = ComponentProps<typeof BookCarousel>;

const Fixture = () => {
  // Control props in Cosmos via the "Props" panel with sensible defaults
  const [fixtureProps] = useFixtureInput<BookCarouselProps>("Props", {
    autoplayIntervalNum: 3000,
  });
  const { autoplayIntervalNum } = fixtureProps;

  return (
    <div className="p-4 max-w-10/12 mx-auto">
      <h3 className="mb-4 text-lg font-semibold">Home Carousel Component</h3>

      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          BookCarousel is a Swiper-based carousel for showcasing recommended
          books on the home page. It supports autoplay, pagination indicators,
          and infinite looping.
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg p-4">
        <div className="mb-4">
          <p className="text-sm font-medium">Current settings:</p>
          <ul className="mt-2 text-sm space-y-1">
            <li>
              <strong>Autoplay interval:</strong> {autoplayIntervalNum}ms
            </li>
            <li>
              <strong>Loop:</strong> Enabled
            </li>
            <li>
              <strong>Pagination:</strong> Enabled
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          <div className="text-purple w-2/3 p-4 flex-none">
            <BookCarousel {...fixtureProps} />
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <h4 className="font-medium mb-2">
            Examples with different playback speeds
          </h4>
          <div className="space-y-4">
            <div className="border rounded p-4">
              <p className="text-sm font-medium mb-2">
                Fast playback (1s interval):
              </p>
              <BookCarousel autoplayIntervalNum={1000} />
            </div>

            <div className="border rounded p-4">
              <p className="text-sm font-medium mb-2">
                Slow playback (5s interval):
              </p>
              <BookCarousel autoplayIntervalNum={5000} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-500">
        <p>BookCarousel highlights:</p>
        <ul className="mt-2 list-disc list-inside space-y-1">
          <li>Uses Swiper for carousel behavior</li>
          <li>Supports autoplay and infinite loop</li>
          <li>Responsive across screen sizes</li>
          <li>Includes pagination indicators</li>
          <li>Each slide includes a book cover and description</li>
          <li>Uses Material-UI Grid layout</li>
        </ul>
      </div>
    </div>
  );
};

Fixture.displayName = "HomeCarouselFixture";

export default Fixture;
