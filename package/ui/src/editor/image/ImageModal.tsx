import {useState} from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import type {ImageProvider} from './types';
import {rezicsUploadProvider} from './RezicsUploadProvider';
import {imgbbGuide} from './imgbb-guide';
import {postimagesGuide} from './postimages-guide';
import {imgboxGuide} from './imgbox-guide';

const defaultProviders: ImageProvider[] = [
  rezicsUploadProvider,
  imgbbGuide,
  postimagesGuide,
  imgboxGuide,
];

export interface ImageModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (url: string, alt?: string) => void;
  providers?: ImageProvider[];
}

export function ImageModal({
  open,
  onClose,
  onInsert,
  providers = defaultProviders,
}: ImageModalProps) {
  const [tabIndex, setTabIndex] = useState(0);

  const handleInsert = (url: string, alt?: string) => {
    onInsert(url, alt);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Insert Image</DialogTitle>
      <DialogContent dividers>
        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {providers.map((p) => (
            <Tab key={p.name} icon={p.icon} label={p.label} iconPosition="start" />
          ))}
        </Tabs>
        {providers[tabIndex]?.render({onInsert: handleInsert})}
      </DialogContent>
    </Dialog>
  );
}
