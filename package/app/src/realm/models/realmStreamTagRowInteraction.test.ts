import { describe, expect, it } from "bun:test";
import {
  resolveHorizontalWheelScroll,
  shouldSuppressTagRowClick,
} from "./realmStreamTagRowInteraction";

describe("realm stream tag row interaction", () => {
  it("turns vertical wheel movement into horizontal row scroll", () => {
    expect(
      resolveHorizontalWheelScroll({
        deltaX: 0,
        deltaY: 40,
        maxScrollLeft: 100,
        scrollLeft: 10,
      }),
    ).toEqual({ nextScrollLeft: 50, preventPageScroll: true });
  });

  it("does not suppress page scroll when the row cannot consume the wheel", () => {
    expect(
      resolveHorizontalWheelScroll({
        deltaX: 0,
        deltaY: 40,
        maxScrollLeft: 100,
        scrollLeft: 100,
      }),
    ).toEqual({ nextScrollLeft: 100, preventPageScroll: false });
    expect(
      resolveHorizontalWheelScroll({
        deltaX: 0,
        deltaY: 40,
        maxScrollLeft: 0,
        scrollLeft: 0,
      }),
    ).toEqual({ nextScrollLeft: 0, preventPageScroll: false });
  });

  it("leaves primarily horizontal wheel input alone", () => {
    expect(
      resolveHorizontalWheelScroll({
        deltaX: 50,
        deltaY: 10,
        maxScrollLeft: 100,
        scrollLeft: 10,
      }),
    ).toEqual({ nextScrollLeft: 10, preventPageScroll: false });
  });

  it("suppresses chip clicks only after meaningful pointer movement", () => {
    expect(shouldSuppressTagRowClick(1.5)).toBeFalse();
    expect(shouldSuppressTagRowClick(2)).toBeTrue();
    expect(shouldSuppressTagRowClick(-8)).toBeTrue();
  });
});
