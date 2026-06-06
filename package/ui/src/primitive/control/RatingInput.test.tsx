import { describe, expect, mock, test } from "bun:test";
import type { ReactElement } from "react";

import { RatingInput, type RatingInputProps } from "./RatingInput";

type AnyElement = ReactElement<{
  children?: AnyElement | AnyElement[];
  onClick?: () => void;
  onKeyDown?: (event: { key: string; preventDefault: () => void }) => void;
  tabIndex?: number;
  disabled?: boolean;
  role?: string;
  "aria-checked"?: boolean;
  "aria-disabled"?: boolean;
  "data-state"?: "filled" | "empty";
  "data-readonly"?: boolean;
}>;

function render(props: RatingInputProps): AnyElement {
  return RatingInput(props) as AnyElement;
}

function getStars(element: AnyElement): AnyElement[] {
  const children = (element.props.children ?? []) as AnyElement | AnyElement[];
  return Array.isArray(children) ? children : [children];
}

function fireKey(element: AnyElement, key: string) {
  let prevented = false;
  element.props.onKeyDown?.({
    key,
    preventDefault: () => {
      prevented = true;
    },
  });
  return prevented;
}

describe("RatingInput", () => {
  test("renders with value=null shows all empty", () => {
    const onChange = mock();
    const stars = getStars(render({ value: null, onChange, max: 5 }));

    expect(stars).toHaveLength(5);
    for (const star of stars) {
      expect(star.props["data-state"]).toBe("empty");
      expect(star.props["aria-checked"]).toBe(false);
    }
  });

  test("value=3 fills the first three stars", () => {
    const onChange = mock();
    const stars = getStars(render({ value: 3, onChange, max: 5 }));

    expect(stars.map((s) => s.props["data-state"])).toEqual([
      "filled",
      "filled",
      "filled",
      "empty",
      "empty",
    ]);
  });

  test("clicking star 5 emits 5", () => {
    const onChange = mock();
    const stars = getStars(render({ value: null, onChange, max: 5 }));

    stars[4]?.props.onClick?.();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(5);
  });

  test("clicking the currently-selected star clears the value", () => {
    const onChange = mock();
    const stars = getStars(render({ value: 5, onChange, max: 5 }));

    stars[4]?.props.onClick?.();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  test("ArrowRight from value=3 emits 4", () => {
    const onChange = mock();
    const element = render({ value: 3, onChange, max: 5 });

    fireKey(element, "ArrowRight");

    expect(onChange).toHaveBeenCalledWith(4);
  });

  test("ArrowRight at max is clamped (no emission)", () => {
    const onChange = mock();
    const element = render({ value: 5, onChange, max: 5 });

    fireKey(element, "ArrowRight");

    expect(onChange).not.toHaveBeenCalled();
  });

  test("ArrowLeft from value=1 is clamped (no emission)", () => {
    const onChange = mock();
    const element = render({ value: 1, onChange, max: 5 });

    fireKey(element, "ArrowLeft");

    expect(onChange).not.toHaveBeenCalled();
  });

  test("Home emits 1", () => {
    const onChange = mock();
    const element = render({ value: 4, onChange, max: 5 });

    fireKey(element, "Home");

    expect(onChange).toHaveBeenCalledWith(1);
  });

  test("End emits max", () => {
    const onChange = mock();
    const element = render({ value: 1, onChange, max: 7 });

    fireKey(element, "End");

    expect(onChange).toHaveBeenCalledWith(7);
  });

  test("Backspace emits null", () => {
    const onChange = mock();
    const element = render({ value: 4, onChange, max: 5 });

    fireKey(element, "Backspace");

    expect(onChange).toHaveBeenCalledWith(null);
  });

  test("digit key sets the value", () => {
    const onChange = mock();
    const element = render({ value: null, onChange, max: 10 });

    fireKey(element, "7");

    expect(onChange).toHaveBeenCalledWith(7);
  });

  test("digit beyond max is ignored", () => {
    const onChange = mock();
    const element = render({ value: 1, onChange, max: 5 });

    fireKey(element, "9");

    expect(onChange).not.toHaveBeenCalled();
  });

  test("'0' clears when max < 10", () => {
    const onChange = mock();
    const element = render({ value: 3, onChange, max: 5 });

    fireKey(element, "0");

    expect(onChange).toHaveBeenCalledWith(null);
  });

  test("'0' selects 10 when max >= 10", () => {
    const onChange = mock();
    const element = render({ value: 1, onChange, max: 10 });

    fireKey(element, "0");

    expect(onChange).toHaveBeenCalledWith(10);
  });

  test("disabled prevents click and key onChange", () => {
    const onChange = mock();
    const element = render({ value: 2, onChange, max: 5, disabled: true });
    const stars = getStars(element);

    stars[3]?.props.onClick?.();
    fireKey(element, "ArrowRight");
    fireKey(element, "Home");

    expect(onChange).not.toHaveBeenCalled();
    expect(element.props["aria-disabled"]).toBe(true);
  });

  test("readOnly prevents click and key onChange while staying enabled", () => {
    const onChange = mock();
    const element = render({ value: 2, onChange, max: 5, readOnly: true });
    const stars = getStars(element);

    stars[3]?.props.onClick?.();
    fireKey(element, "ArrowRight");

    expect(onChange).not.toHaveBeenCalled();
    expect(element.props["data-readonly"]).toBe(true);
  });

  test("radiogroup is a single tab stop", () => {
    const onChange = mock();
    const element = render({ value: 3, onChange, max: 5 });
    const stars = getStars(element);

    expect(element.props.tabIndex).toBe(0);
    for (const star of stars) {
      expect(star.props.tabIndex).toBe(-1);
    }
  });

  test("max defaults to SCORE_MAX (10)", () => {
    const onChange = mock();
    const stars = getStars(render({ value: null, onChange }));

    expect(stars).toHaveLength(10);
  });
});
