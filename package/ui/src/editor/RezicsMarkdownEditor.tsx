import {useState, useCallback, useRef} from 'react';
import {MarkdownEditor} from '@rezics/editor/editor';
import type {MarkdownEditorProps} from '@rezics/editor/editor';
import type {ResizeConfig} from '@rezics/editor/editor';
import {insertImageUrl} from '@rezics/editor/markdown';
import {EditorPanel} from './panel/EditorPanel';
import {ImageModal} from './image/ImageModal';
import Button from '@mui/material/Button';
import {Paperclip} from 'lucide-react';
import type {ImageProvider} from './image/types';
import './editor.css';

export const DEFAULT_RESIZE_CONFIG: ResizeConfig = {
  height: 300,
  minHeight: 150,
  maxHeight: 800,
};

export interface RezicsMarkdownEditorProps extends Omit<
  MarkdownEditorProps,
  'viewRef'
> {
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
      <MarkdownEditor
        {...editorProps}
        className="rezics-editor-wrapper"
        resize={resolvedResize}
        viewRef={handleViewRef}
      />
      <EditorPanel
        left={
          <Button
            variant="text"
            startIcon={<Paperclip />}
            onClick={() => setImageModalOpen(true)}
            title="Insert image"
            sx={{
              textTransform: 'none',
              fontSize: '0.9rem',
              lineHeight: 1,
              px: 1,
              '& .MuiButton-startIcon': {
                '& svg': {
                  height: '0.9em',
                },
              },
            }}
          >
            upload image
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
