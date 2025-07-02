import React, { useEffect, useRef } from "react";
import EasyMDE from "easymde";
import "easymde/dist/easymde.min.css";
import MarkdownIt from "markdown-it";

import { preserveFormattingPlugin } from "./preserveFormatPlugin";

interface EasyEditorProps {
    value: string;
    onChange: (value: string) => void;
}

const EasyEditor: React.FC<EasyEditorProps> = ({ value, onChange }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const easyMDEInstance = useRef<EasyMDE | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

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
                initialValue: value || "",
                spellChecker: false,
                sideBySideFullscreen: false,
                // preview
                previewClass: ["editor-preview", "ics-md-preview"],
                previewRender: (plainText) => {
                    console.log(plainText);
                    return md.render(plainText);
                },
                toolbar: [
                    { name: "bold", action: EasyMDE.toggleBold, className: "bx bx-bold", title: "Bold" },
                    { name: "italic", action: EasyMDE.toggleItalic, className: "bx bx-italic", title: "Italic" },
                    {
                        name: "heading",
                        action: EasyMDE.toggleHeadingSmaller,
                        className: "bx bx-heading",
                        title: "Heading",
                    },
                    "|",
                    {
                        name: "quote",
                        action: EasyMDE.toggleBlockquote,
                        className: "bx bxs-quote-alt-right",
                        title: "Quote",
                    },
                    {
                        name: "unordered-list",
                        action: EasyMDE.toggleUnorderedList,
                        className: "bx bx-list-ul",
                        title: "Generic List",
                    },
                    {
                        name: "ordered-list",
                        action: EasyMDE.toggleOrderedList,
                        className: "bx bx-list-ol",
                        title: "Numbered List",
                    },
                    "|",
                    { name: "link", action: EasyMDE.drawLink, className: "bx bx-link", title: "Create Link" },
                    { name: "image", action: EasyMDE.drawImage, className: "bx bx-image", title: "Insert Image" },
                    { name: "table", action: EasyMDE.drawTable, className: "bx bx-table", title: "Insert Table" },
                    "|",
                    {
                        name: "preview",
                        action: EasyMDE.togglePreview,
                        className: "bx bx-show no-disable",
                        title: "Toggle Preview",
                    },
                    {
                        name: "side-by-side",
                        action: EasyMDE.toggleSideBySide,
                        className: "bx bxs-book-content",
                        title: "Toggle Side by Side",
                    },
                    {
                        name: "guide",
                        action: () => {
                            window.open("https://www.markdownguide.org/basic-syntax/", "_blank");
                        },
                        className: "bx bx-help-circle no-disable",
                        title: "Markdown Guide",
                    },
                ],
            });

            easyMDEInstance.current.codemirror.on("change", () => {
                if (easyMDEInstance.current) {
                    onChangeRef.current(easyMDEInstance.current.value());
                }
            });
        }

        return () => {
            if (easyMDEInstance.current) {
                easyMDEInstance.current.toTextArea();
                easyMDEInstance.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (easyMDEInstance.current && easyMDEInstance.current.value() !== value) {
            easyMDEInstance.current.value(value || "");
        }
    }, [value]);

    return (
        <div className="easymde-wrapper w-full h-full">
            <textarea ref={textareaRef} />
        </div>
    );
};

export default EasyEditor;
