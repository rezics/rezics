import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shadcn/dialog';
import {Tabs, TabsList, TabsTrigger, TabsContent} from '@/shadcn/tabs';
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
  const handleInsert = (url: string, alt?: string) => {
    onInsert(url, alt);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Insert Image</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue={providers[0]?.name}>
          <TabsList>
            {providers.map((p) => (
              <TabsTrigger key={p.name} value={p.name}>
                <span className="mr-1">{p.icon}</span>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {providers.map((p) => (
            <TabsContent key={p.name} value={p.name}>
              {p.render({onInsert: handleInsert})}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
