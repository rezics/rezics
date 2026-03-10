import {describe, expect, test} from 'bun:test';
import {TrustedEmailField} from './TrustedEmailField';

describe('TrustedEmailField', () => {
  test('renders the edit affordance while the provider email is locked', () => {
    const element = TrustedEmailField({
      value: 'reader@example.com',
      locked: true,
      onChange: () => undefined,
      onUnlock: () => undefined,
      lockedHelperText: 'Trusted email',
      editableHelperText: 'Editable email',
    });

    const children = element.props.children as Array<any>;
    const textField = children[0];
    const buttonWrapper = children[1];

    expect(textField.props.disabled).toBe(true);
    expect(textField.props.helperText).toBe('Trusted email');
    expect(buttonWrapper.props.children.props.children).toBe('Edit Email');
  });

  test('drops the edit affordance after the field is unlocked', () => {
    const element = TrustedEmailField({
      value: 'reader@example.com',
      locked: false,
      onChange: () => undefined,
      onUnlock: () => undefined,
      lockedHelperText: 'Trusted email',
      editableHelperText: 'Editable email',
    });

    const children = element.props.children as Array<any>;
    const textField = children[0];
    const buttonWrapper = children[1];

    expect(textField.props.disabled).toBe(false);
    expect(textField.props.helperText).toBe('Editable email');
    expect(buttonWrapper).toBeNull();
  });
});
