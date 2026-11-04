"use client";

/**
 * RichTextEditor: tiptap v3 WYSIWYG with HTML in/out (`value` / `onChange`).
 * Styled with `prose-museum`; syncs when `value` changes externally (e.g. language tab switch).
 * Images are inserted through MediaPicker.
 */
import * as React from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Heading2, Heading3, ImagePlus, Italic, Link2, Link2Off, List, ListOrdered,
  Minus, Pilcrow, Quote, Redo2, Strikethrough, Underline as UnderlineIcon, Undo2,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { MediaPicker } from "./media-picker";

export interface RichTextEditorProps {
  value?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Minimum editing height in px (default 260). */
  minHeight?: number;
  className?: string;
  disabled?: boolean;
}

function Btn({ on, active, label, disabled, children }: { on: () => void; active?: boolean; label: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={on}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
        active && "bg-primary-soft text-primary",
      )}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-border" aria-hidden />;

function Toolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const t = useTranslations("admin.kit");
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      p: e.isActive("paragraph"), h2: e.isActive("heading", { level: 2 }), h3: e.isActive("heading", { level: 3 }),
      b: e.isActive("bold"), i: e.isActive("italic"), u: e.isActive("underline"), s: e.isActive("strike"),
      ul: e.isActive("bulletList"), ol: e.isActive("orderedList"), q: e.isActive("blockquote"),
      l: e.isActive({ textAlign: "left" }), c: e.isActive({ textAlign: "center" }), r: e.isActive({ textAlign: "right" }),
      link: e.isActive("link"), undo: e.can().undo(), redo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();

  const setLink = () => {
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt(t("linkPrompt"), prev);
    if (url === null) return;
    if (url.trim() === "") c().extendMarkRange("link").unsetLink().run();
    else c().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1.5">
      <Btn on={() => c().setParagraph().run()} active={s.p} label={t("paragraph")}><Pilcrow className="size-4" /></Btn>
      <Btn on={() => c().toggleHeading({ level: 2 }).run()} active={s.h2} label="H2"><Heading2 className="size-4" /></Btn>
      <Btn on={() => c().toggleHeading({ level: 3 }).run()} active={s.h3} label="H3"><Heading3 className="size-4" /></Btn>
      <Sep />
      <Btn on={() => c().toggleBold().run()} active={s.b} label={t("bold")}><Bold className="size-4" /></Btn>
      <Btn on={() => c().toggleItalic().run()} active={s.i} label={t("italic")}><Italic className="size-4" /></Btn>
      <Btn on={() => c().toggleUnderline().run()} active={s.u} label={t("underline")}><UnderlineIcon className="size-4" /></Btn>
      <Btn on={() => c().toggleStrike().run()} active={s.s} label={t("strike")}><Strikethrough className="size-4" /></Btn>
      <Sep />
      <Btn on={() => c().toggleBulletList().run()} active={s.ul} label={t("bulletList")}><List className="size-4" /></Btn>
      <Btn on={() => c().toggleOrderedList().run()} active={s.ol} label={t("orderedList")}><ListOrdered className="size-4" /></Btn>
      <Btn on={() => c().toggleBlockquote().run()} active={s.q} label={t("quote")}><Quote className="size-4" /></Btn>
      <Sep />
      <Btn on={() => c().setTextAlign("left").run()} active={s.l} label={t("alignLeft")}><AlignLeft className="size-4" /></Btn>
      <Btn on={() => c().setTextAlign("center").run()} active={s.c} label={t("alignCenter")}><AlignCenter className="size-4" /></Btn>
      <Btn on={() => c().setTextAlign("right").run()} active={s.r} label={t("alignRight")}><AlignRight className="size-4" /></Btn>
      <Sep />
      <Btn on={setLink} active={s.link} label={t("link")}><Link2 className="size-4" /></Btn>
      <Btn on={() => c().unsetLink().run()} disabled={!s.link} label={t("unlink")}><Link2Off className="size-4" /></Btn>
      <Btn on={onImage} label={t("insertImage")}><ImagePlus className="size-4" /></Btn>
      <Btn on={() => c().setHorizontalRule().run()} label={t("rule")}><Minus className="size-4" /></Btn>
      <Sep />
      <Btn on={() => c().undo().run()} disabled={!s.undo} label={t("undo")}><Undo2 className="size-4" /></Btn>
      <Btn on={() => c().redo().run()} disabled={!s.redo} label={t("redo")}><Redo2 className="size-4" /></Btn>
    </div>
  );
}

export function RichTextEditor({ value = "", onChange, placeholder, minHeight = 260, className, disabled }: RichTextEditorProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    content: value,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true } }),
      Image.configure({ HTMLAttributes: { loading: "lazy" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    editorProps: {
      attributes: { class: "prose-museum max-w-none px-4 py-3 outline-none", style: `min-height:${minHeight}px` },
    },
    onUpdate: ({ editor: e }) => onChangeRef.current(e.isEmpty ? "" : e.getHTML()),
  });

  // Keep editor content in sync with external value changes.
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  React.useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-input bg-background transition-shadow focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40",
        disabled && "opacity-60",
        className,
      )}
    >
      {editor ? <Toolbar editor={editor} onImage={() => setPickerOpen(true)} /> : <div className="h-11 border-b border-border bg-muted/40" />}
      {editor ? <EditorContent editor={editor} /> : <div style={{ minHeight }} />}
      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple
        onSelect={(items) => {
          const chain = editor?.chain().focus();
          items.forEach((m) => chain?.setImage({ src: m.url, alt: m.original_name }));
          chain?.run();
        }}
      />
    </div>
  );
}
