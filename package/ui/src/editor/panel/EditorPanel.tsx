import type {ReactNode} from 'react';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';

export interface EditorPanelProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function EditorPanel({left, right, className}: EditorPanelProps) {
  return (
    <Toolbar
      variant="dense"
      disableGutters
      className={className}
      sx={{
        gap: 0.5,
        px: 1,
        minHeight: 36,
        borderTop: '1px solid var(--editor-border-color, #d0d7de)',
      }}
    >
      {left && (
        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0}}>
          {left}
        </Box>
      )}
      <Box sx={{flex: 1}} />
      {right && (
        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
          {right}
        </Box>
      )}
    </Toolbar>
  );
}
