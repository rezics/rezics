import {useState, useCallback, useRef} from 'react';
import {MarkdownEditor} from '@rezics/editor/editor';
import type {MarkdownEditorProps} from '@rezics/editor/editor';
import type {ResizeConfig} from '@rezics/editor/editor';
import {insertImageUrl} from '@rezics/editor/markdown';
import {EditorPanel} from './panel/EditorPanel';
import {ImageModal} from './image/ImageModal';
import Button from '@mui/material/Button';
import ImageIcon from '@mui/icons-material/Image';
import type {ImageProvider} from './image/types';

export const DEFAULT_RESIZE_CONFIG: ResizeConfig = {
  height: 300,
  minHeight: 150,
  maxHeight: 800,
};

export interface RezicsMarkdownEditorProps
  extends Omit<MarkdownEditorProps, 'viewRef'> {
  onSubmit?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  imageProviders?: ImageProvider[];
  disableResize?: boolean;
}

export function RezicsMarkdownEditor({
  onSubmit,
  onCancel,
  submitLabel = 'Submit',
  imageProviders,
  disableResize,
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

  const resolvedResize = disableResize
    ? undefined
    : (editorProps.resize ?? DEFAULT_RESIZE_CONFIG);

  return (
    <div>
      <MarkdownEditor {...editorProps} resize={resolvedResize} viewRef={handleViewRef} />
      <EditorPanel
        left={
          <Button
            size="small"
            startIcon={<ImageIcon />}
            onClick={() => setImageModalOpen(true)}
            title="Insert image"
          >
            Image
          </Button>
        }
        right={
          <>
            {onCancel && (
              <Button size="small" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {onSubmit && (
              <Button size="small" variant="contained" onClick={onSubmit}>
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
