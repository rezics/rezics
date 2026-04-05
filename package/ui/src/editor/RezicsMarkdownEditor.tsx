import {useState, useCallback, useRef} from 'react';
import {MarkdownEditor} from '@rezics/editor/editor';
import type {MarkdownEditorProps} from '@rezics/editor/editor';
import {insertImageUrl} from '@rezics/editor/markdown';
import {EditorPanel} from './panel/EditorPanel';
import {ImageModal} from './image/ImageModal';
import {Button} from '@/shadcn/button';
import type {ImageProvider} from './image/types';

export interface RezicsMarkdownEditorProps
  extends Omit<MarkdownEditorProps, 'viewRef'> {
  onSubmit?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  imageProviders?: ImageProvider[];
}

export function RezicsMarkdownEditor({
  onSubmit,
  onCancel,
  submitLabel = 'Submit',
  imageProviders,
  ...editorProps
}: RezicsMarkdownEditorProps) {
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const viewRef = useRef<any>(null);

  const handleViewRef = useCallback((view: any) => {
    viewRef.current = view;
  }, []);

  const handleInsertImage = useCallback((url: string, alt?: string) => {
    if (viewRef.current) {
      insertImageUrl(viewRef.current, url, alt);
    }
  }, []);

  return (
    <div>
      <MarkdownEditor {...editorProps} viewRef={handleViewRef} />
      <EditorPanel
        left={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setImageModalOpen(true)}
            title="Insert image"
          >
            🖼️ Image
          </Button>
        }
        right={
          <>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {onSubmit && (
              <Button size="sm" onClick={onSubmit}>
                {submitLabel}
              </Button>
            )}
          </>
        }
      />
      <ImageModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onInsert={handleInsertImage}
        providers={imageProviders}
      />
    </div>
  );
}
