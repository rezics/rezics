import { showPanel, type Panel } from '@codemirror/view';
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import type { ToolbarItem } from '../types';

function createPanelToolbar(items: ToolbarItem[]): (view: EditorView) => Panel {
  return (view: EditorView) => {
    const dom = document.createElement('div');
    dom.className = 'cm-toolbar-panel';
    dom.setAttribute('role', 'toolbar');

    const buttons: { button: HTMLButtonElement; item: ToolbarItem }[] = [];

    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cm-toolbar-button';
      button.title = item.label;
      button.textContent =
        typeof item.icon === 'string' ? item.icon : item.label;
      button.addEventListener('click', (e) => {
        e.preventDefault();
        item.action(view);
        view.focus();
      });
      dom.appendChild(button);
      buttons.push({ button, item });
    }

    function updateActiveStates() {
      const state = view.state;
      for (const { button, item } of buttons) {
        if (item.isActive) {
          button.classList.toggle('cm-toolbar-button-active', item.isActive(state));
        }
      }
    }

    updateActiveStates();

    return {
      dom,
      top: true,
      update() {
        updateActiveStates();
      },
    };
  };
}

export function panelToolbar(items: ToolbarItem[]): Extension {
  return [
    showPanel.of(createPanelToolbar(items)),
    EditorView.baseTheme({
      '.cm-toolbar-panel': {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '2px',
        padding: '4px 8px',
        borderBottom: '1px solid #ddd',
      },
      '.cm-toolbar-button': {
        padding: '2px 8px',
        border: '1px solid transparent',
        borderRadius: '3px',
        background: 'none',
        cursor: 'pointer',
        fontSize: '13px',
        '&:hover': {
          background: '#f0f0f0',
        },
      },
      '.cm-toolbar-button-active': {
        background: '#e0e0e0',
        borderColor: '#ccc',
      },
    }),
  ];
}
