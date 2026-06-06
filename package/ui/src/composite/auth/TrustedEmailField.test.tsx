import { describe, expect, test } from "bun:test";
import { TrustedEmailField } from "./TrustedEmailField";

describe("TrustedEmailField", () => {
  test("renders the edit affordance while the provider email is locked", () => {
    const element = TrustedEmailField({
      value: "reader@example.com",
      locked: true,
      onChange: () => undefined,
      onUnlock: () => undefined,
      lockedHelperText: "Trusted email",
      editableHelperText: "Editable email",
    });

    const children = (element as any).props.children as Array<any>;
    const textField = children[1];
    const helperText = children[2];
    const buttonWrapper = children[3];

    expect(textField.props.disabled).toBe(true);
    expect(helperText.props.children).toBe("Trusted email");
    expect(buttonWrapper.props.children.props.children).toBe("Edit Email");
  });

  test("drops the edit affordance after the field is unlocked", () => {
    const element = TrustedEmailField({
      value: "reader@example.com",
      locked: false,
      onChange: () => undefined,
      onUnlock: () => undefined,
      lockedHelperText: "Trusted email",
      editableHelperText: "Editable email",
    });

    const children = (element as any).props.children as Array<any>;
    const textField = children[1];
    const helperText = children[2];
    const buttonWrapper = children[3];

    expect(textField.props.disabled).toBe(false);
    expect(helperText.props.children).toBe("Editable email");
    expect(buttonWrapper).toBeNull();
  });
});
