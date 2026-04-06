import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { useState } from "react";
import { imgbbGuide } from "./imgbb-guide";
import { imgboxGuide } from "./imgbox-guide";
import { postimagesGuide } from "./postimages-guide";
import { rezicsUploadProvider } from "./RezicsUploadProvider";
import type { ImageProvider } from "./types";

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
      <DialogContent dividers>
        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 36, mb: 1 }}
        >
          {providers.map((p) => (
            <Tab
              key={p.name}
              icon={p.icon}
              label={p.label}
              iconPosition="start"
              sx={{ minHeight: 36, py: 0.5, px: 1.5, fontSize: "0.8125rem" }}
            />
          ))}
        </Tabs>
        {providers[tabIndex]?.render({ onInsert: handleInsert })}
      </DialogContent>
    </Dialog>
  );
}
