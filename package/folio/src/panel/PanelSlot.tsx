import type { ComponentType } from 'react';
import { useFolio } from '../context';
import type { PanelProps, FolioContent, FolioNode } from '../types';

interface PanelSlotProps {
  slot: 'Toolbar' | 'Controls' | 'Settings';
  onTreeChange?: (tree: FolioNode[]) => void;
}

export function PanelSlot({ slot, onTreeChange }: PanelSlotProps) {
  const { state, dispatch, content, registry } = useFolio();

  const components: ComponentType<PanelProps>[] = registry.collectSlot(slot);

  if (components.length === 0 || !content) return null;

  const panelProps: PanelProps = {
    document: content,
    state,
    dispatch,
    requestTreeChange: onTreeChange,
  };

  return (
    <>
      {components.map((Component, i) => (
        <Component key={i} {...panelProps} />
      ))}
    </>
  );
}
