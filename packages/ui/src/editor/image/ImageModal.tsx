import { useState } from "react";
import { Dialog, DialogContent } from "#/shadcn/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/shadcn/tabs";
import { imgbbGuide } from "./imgbb-guide";
import { imgboxGuide } from "./imgbox-guide";
import { postimagesGuide } from "./postimages-guide";
import type { ImageProvider } from "./types";

const defaultProviders: ImageProvider[] = [
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
  const initial = providers[0]?.name ?? "";
  const [active, setActive] = useState<string>(initial);

  const handleInsert = (url: string, alt?: string) => {
    onInsert(url, alt);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <Tabs value={active} onValueChange={setActive}>
          <TabsList className="overflow-x-auto">
            {providers.map((p) => (
              <TabsTrigger
                key={p.name}
                value={p.name}
                className="text-[0.8125rem] gap-1"
              >
                {p.icon}
                <span>{p.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {providers.map((p) => (
            <TabsContent key={p.name} value={p.name}>
              {p.render({ onInsert: handleInsert })}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
