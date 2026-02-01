import EasyMDE from 'easymde';
import React, {lazy, useCallback, useEffect, useRef, useState} from 'react';
import 'easymde/dist/easymde.min.css';
import MarkdownIt from 'markdown-it';

import {preserveFormattingPlugin} from './preserveFormatPlugin';
import {EditorMentionPicker, type MentionUserOption} from './EditorMention';

const EmojiMartPicker = lazy(() =>
  import('./EmojiMart').then(m => ({default: m.EmojiMartPicker})),
);

interface EasyEditorProps {
  value: string;
  onChange: (value: string) => void;
  initialValue?: string;
}

type CMPos = {line: number; ch: number};

const EasyEditor: React.FC<EasyEditorProps> = ({
  value,
  onChange,
  initialValue,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const easyMDEInstance = useRef<EasyMDE | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionAnchorPosition, setMentionAnchorPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);

  const mentionOpenRef = useRef(false);
  const mentionQueryRef = useRef('');
  const mentionFromRef = useRef<CMPos | null>(null);
  const mentionAnchorPositionRef = useRef<{top: number; left: number} | null>(
    null,
  );
  const mentionActiveIndexRef = useRef(0);
  const mentionOptionsRef = useRef<MentionUserOption[]>([]);
  const mentionSuppressNextRefreshRef = useRef(false);

  const [emojiOpen, setEmojiOpen] = useState(false);

  const emojiOpenRef = useRef(false);

  const setMentionActiveIndexSafe = useCallback((idx: number) => {
    mentionActiveIndexRef.current = idx;
    setMentionActiveIndex(idx);
  }, []);

  const closeEmoji = useCallback(() => {
    emojiOpenRef.current = false;
    setEmojiOpen(false);
  }, []);

  const closeMention = useCallback(() => {
    mentionOpenRef.current = false;
    mentionQueryRef.current = '';
    mentionFromRef.current = null;
    mentionAnchorPositionRef.current = null;
    mentionActiveIndexRef.current = 0;
    mentionOptionsRef.current = [];

    setMentionOpen(false);
    setMentionQuery('');
    setMentionAnchorPosition(null);
    setMentionActiveIndex(0);
  }, []);

  const pickEmoji = useCallback((nativeEmoji: string) => {
    const cm = easyMDEInstance.current?.codemirror as any;
    if (!cm) return;

    if (cm.somethingSelected && cm.somethingSelected()) {
      cm.replaceSelection(nativeEmoji, 'around');
    } else {
      const cursor = cm.getCursor() as CMPos;
      cm.replaceRange(nativeEmoji, cursor, cursor, '+emoji');
    }
    cm.focus();
    // closeEmoji();
  }, []);

  const pickMention = useCallback(
    (user: MentionUserOption) => {
      const cm = easyMDEInstance.current?.codemirror as any;
      const from = mentionFromRef.current;
      if (!cm || !from) return;

      const cursor = cm.getCursor() as CMPos;
      const display = (user.name ?? user.unitId ?? '').trim();
      if (!display) return;

      const insertText = `@${display} `;
      mentionSuppressNextRefreshRef.current = true;
      cm.replaceRange(insertText, from, cursor, '+mention');
      cm.focus();
      closeMention();
    },
    [closeMention],
  );

  // console.log("initialValue", initialValue);

  useEffect(() => {
    if (textareaRef.current) {
      const md = new MarkdownIt({
        html: false,
        // html: true,
        linkify: true,
        breaks: true, // key: convert \n to <br>
        typographer: false,
      });

      md.use(preserveFormattingPlugin);

      easyMDEInstance.current = new EasyMDE({
        element: textareaRef.current,
        initialValue: value || '',
        spellChecker: false,
        sideBySideFullscreen: false,
        // preview
        previewClass: ['editor-preview', 'ics-md-preview', 'markdown-body'],
        previewRender: plainText => {
          return md.render(plainText);
        },
        toolbar: [
          {
            name: 'bold',
            action: EasyMDE.toggleBold,
            className: 'bx bx-bold',
            title: 'Bold',
          },
          {
            name: 'italic',
            action: EasyMDE.toggleItalic,
            className: 'bx bx-italic',
            title: 'Italic',
          },
          {
            name: 'heading',
            action: EasyMDE.toggleHeadingSmaller,
            className: 'bx bx-heading',
            title: 'Heading',
          },
          '|',
          {
            name: 'quote',
            action: EasyMDE.toggleBlockquote,
            className: 'bx bxs-quote-alt-right',
            title: 'Quote',
          },
          {
            name: 'unordered-list',
            action: EasyMDE.toggleUnorderedList,
            className: 'bx bx-list-ul',
            title: 'Generic List',
          },
          {
            name: 'ordered-list',
            action: EasyMDE.toggleOrderedList,
            className: 'bx bx-list-ol',
            title: 'Numbered List',
          },
          {
            name: 'emoji',
            action: () => {
              const cm = easyMDEInstance.current?.codemirror as any;
              if (!cm) return;
              emojiOpenRef.current = !emojiOpenRef.current;
              setEmojiOpen(emojiOpenRef.current);
            },
            className: 'bx bx-smile',
            title: 'Insert Emoji',
          },
          '|',
          {
            name: 'link',
            action: EasyMDE.drawLink,
            className: 'bx bx-link',
            title: 'Create Link',
          },
          {
            name: 'image',
            action: EasyMDE.drawImage,
            className: 'bx bx-image',
            title: 'Insert Image',
          },
          {
            name: 'table',
            action: EasyMDE.drawTable,
            className: 'bx bx-table',
            title: 'Insert Table',
          },
          '|',
          {
            name: 'preview',
            action: EasyMDE.togglePreview,
            className: 'bx bx-show no-disable',
            title: 'Toggle Preview',
          },
          {
            name: 'side-by-side',
            action: EasyMDE.toggleSideBySide,
            className: 'bx bxs-book-content',
            title: 'Toggle Side by Side',
          },
          {
            name: 'guide',
            action: () => {
              window.open(
                'https://www.markdownguide.org/basic-syntax/',
                '_blank',
              );
            },
            className: 'bx bx-help-circle no-disable',
            title: 'Markdown Guide',
          },
        ],
      });

      const cm = easyMDEInstance.current.codemirror as any;

      const refreshMention = () => {
        if (mentionSuppressNextRefreshRef.current) {
          mentionSuppressNextRefreshRef.current = false;
          return;
        }
        if (!cm) return;
        if (emojiOpenRef.current) return;
        if (cm.somethingSelected && cm.somethingSelected()) {
          if (mentionOpenRef.current) closeMention();
          return;
        }

        const cursor = cm.getCursor() as CMPos;
        const line = (cm.getLine(cursor.line) as string) ?? '';
        const before = line.slice(0, cursor.ch);

        // Match: start or whitespace/punct + @ + query (no spaces)
        const m = before.match(/(^|[\s([{<])@([^\s@]{0,32})$/);
        if (!m) {
          if (mentionOpenRef.current) closeMention();
          return;
        }

        const atIndex = before.lastIndexOf('@');
        if (atIndex < 0) {
          if (mentionOpenRef.current) closeMention();
          return;
        }

        const query = m[2] ?? '';
        const coords = cm.cursorCoords(cursor, 'window');
        const anchorPos = {left: coords.left, top: coords.bottom};
        const fromPos: CMPos = {line: cursor.line, ch: atIndex};

        if (!mentionOpenRef.current) {
          mentionOpenRef.current = true;
          setMentionOpen(true);
        }

        if (mentionQueryRef.current !== query) {
          mentionQueryRef.current = query;
          setMentionQuery(query);
          setMentionActiveIndexSafe(0);
        }

        mentionFromRef.current = fromPos;
        mentionAnchorPositionRef.current = anchorPos;
        setMentionAnchorPosition(anchorPos);
      };

      const handleKeyDown = (_: any, e: KeyboardEvent) => {
        if (emojiOpenRef.current) {
          if (e.key === 'Escape') {
            e.preventDefault();
            closeEmoji();
            return;
          }
        }
        if (!mentionOpenRef.current) return;

        const options = mentionOptionsRef.current;
        const len = options.length;

        if (e.key === 'Escape') {
          e.preventDefault();
          closeMention();
          return;
        }

        if (e.key === 'ArrowDown') {
          if (len <= 0) return;
          e.preventDefault();
          setMentionActiveIndexSafe((mentionActiveIndexRef.current + 1) % len);
          return;
        }

        if (e.key === 'ArrowUp') {
          if (len <= 0) return;
          e.preventDefault();
          setMentionActiveIndexSafe(
            (mentionActiveIndexRef.current - 1 + len) % len,
          );
          return;
        }

        if (e.key === 'Enter' || e.key === 'Tab') {
          const picked = options[mentionActiveIndexRef.current];
          if (!picked) return;
          e.preventDefault();
          pickMention(picked);
        }
      };

      cm.on('change', () => {
        if (easyMDEInstance.current) {
          onChangeRef.current(easyMDEInstance.current.value());
        }
      });

      const handleScroll = () => {
        if (emojiOpenRef.current) closeEmoji();
        refreshMention();
      };

      cm.on('cursorActivity', refreshMention);
      cm.on('inputRead', refreshMention);
      cm.on('scroll', handleScroll);
      cm.on('viewportChange', refreshMention);
      cm.on('keydown', handleKeyDown);

      // initial sync
      refreshMention();

      // Cleanup listeners when unmounting
      const cleanup = () => {
        cm.off('cursorActivity', refreshMention);
        cm.off('inputRead', refreshMention);
        cm.off('scroll', handleScroll);
        cm.off('viewportChange', refreshMention);
        cm.off('keydown', handleKeyDown);
      };

      // Attach cleanup to instance for final effect cleanup
      (easyMDEInstance.current as any).__mentionCleanup = cleanup;
    }

    return () => {
      if (easyMDEInstance.current) {
        const cleanup = (easyMDEInstance.current as any).__mentionCleanup;
        if (typeof cleanup === 'function') cleanup();
        easyMDEInstance.current.toTextArea();
        easyMDEInstance.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (easyMDEInstance.current && easyMDEInstance.current.value() !== value) {
      easyMDEInstance.current.value(value || '');
    }
  }, [value]);

  useEffect(() => {
    if (easyMDEInstance.current && initialValue) {
      easyMDEInstance.current.value(initialValue);
    }
  }, [initialValue]);

  return (
    <div className="easymde-wrapper w-full h-full">
      <textarea ref={textareaRef} />
      <EmojiMartPicker
        open={emojiOpen}
        onPick={emoji => pickEmoji(emoji)}
        onClose={closeEmoji}
      />
      <EditorMentionPicker
        open={mentionOpen}
        query={mentionQuery}
        anchorPosition={mentionAnchorPosition}
        activeIndex={mentionActiveIndex}
        setActiveIndex={idx => setMentionActiveIndexSafe(idx)}
        onPick={user => pickMention(user)}
        onClose={closeMention}
        onOptionsChange={options => {
          mentionOptionsRef.current = options;
          if (mentionActiveIndexRef.current >= options.length) {
            setMentionActiveIndexSafe(0);
          }
        }}
      />
    </div>
  );
};

export default EasyEditor;
