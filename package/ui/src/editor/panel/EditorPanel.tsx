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
    <Toolbar variant="dense" disableGutters className={className} sx={{gap: 1}}>
      {left && <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>{left}</Box>}
      <Box sx={{flex: 1}} />
      {right && <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>{right}</Box>}
    </Toolbar>
  );
}
