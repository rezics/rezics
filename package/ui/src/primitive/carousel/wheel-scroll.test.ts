import { describe, expect, it } from "bun:test";
import { resolveCarouselWheelScroll } from "./wheel-scroll";

describe("carousel wheel scroll", () => {
  it("turns vertical wheel movement into horizontal carousel distance", () => {
    expect(
      resolveCarouselWheelScroll({
        axis: "x",
        deltaX: 0,
        deltaY: 40,
        max: 0,
        min: -200,
        target: -20,
      }),
    ).toEqual({ consume: true, distance: -40 });
  });

  it("uses horizontal trackpad movement when it is dominant", () => {
    expect(
      resolveCarouselWheelScroll({
        axis: "x",
        deltaX: 50,
        deltaY: 10,
        max: 0,
        min: -200,
        target: -20,
      }),
    ).toEqual({ consume: true, distance: -50 });
  });

  it("bounds the consumed distance instead of overshooting the end", () => {
    expect(
      resolveCarouselWheelScroll({
        axis: "x",
        deltaX: 0,
        deltaY: 80,
        max: 0,
        min: -100,
        target: -70,
      }),
    ).toEqual({ consume: true, distance: -30 });
  });

  it("releases wheel events at the carousel boundary", () => {
    expect(
      resolveCarouselWheelScroll({
        axis: "x",
        deltaX: 0,
        deltaY: 40,
        max: 0,
        min: -100,
        target: -100,
      }),
    ).toEqual({ consume: false, distance: 0 });

    expect(
      resolveCarouselWheelScroll({
        axis: "x",
        deltaX: 0,
        deltaY: -40,
        max: 0,
        min: -100,
        target: 0,
      }),
    ).toEqual({ consume: false, distance: 0 });
  });

  it("honors Embla axis direction", () => {
    expect(
      resolveCarouselWheelScroll({
        axis: "x",
        deltaX: 0,
        deltaY: 40,
        directionSign: -1,
        max: 200,
        min: 0,
        target: 20,
      }),
    ).toEqual({ consume: true, distance: 40 });
  });

  it("does not bound looping carousels", () => {
    expect(
      resolveCarouselWheelScroll({
        axis: "x",
        deltaX: 0,
        deltaY: 40,
        loop: true,
        max: 0,
        min: -100,
        target: -100,
      }),
    ).toEqual({ consume: true, distance: -40 });
  });
});
