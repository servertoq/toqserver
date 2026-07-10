"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { Extension } from "@tiptap/core";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { useCallback, useEffect, useReducer } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadAdvertisingImage } from "@/lib/advertising";
import { ResizableImage, type ImageAlign } from "./ResizableImage";
import { Indent } from "./indentExtension";

type Props = {
  value: string;
  onChange: (html: string) => void;
  supabase: SupabaseClient;
  userId: string;
  articleKey: string;
};

const FONT_SIZES = [
  { label: "Pequeno", value: "14px" },
  { label: "Normal", value: "16px" },
  { label: "Médio", value: "18px" },
  { label: "Grande", value: "22px" },
  { label: "Título", value: "28px" },
];

const IMAGE_SIZES = [
  { label: "Pequena", width: 200 },
  { label: "Média", width: 360 },
  { label: "Grande", width: 520 },
  { label: "Larga", width: 720 },
];

const COLORS = ["#0f172a", "#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#7c3aed", "#ffffff"];

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

function ToolbarButton({
  active,
  onClick,
  children,
  title,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-xs transition disabled:opacity-40 ${
        active ? "toq-btn-primary text-white" : "toq-btn-outline"
      }`}
    >
      {children}
    </button>
  );
}

export function AdvertisingRichEditor({ value, onChange, supabase, userId, articleKey }: Props) {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      TextStyle,
      FontSize,
      Color,
      Link.configure({ openOnClick: false, autolink: true }),
      ResizableImage.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Indent,
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "advertising-editor prose prose-sm max-w-none min-h-[280px] px-3 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    onSelectionUpdate: () => bump(),
    onTransaction: () => bump(),
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
  }, [editor, value]);

  const insertImage = useCallback(async () => {
    if (!editor) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/gif";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = await uploadAdvertisingImage(supabase, userId, articleKey, file, "inline");
      if (!url) return;
      editor
        .chain()
        .focus()
        .setImage({ src: url })
        .updateAttributes("image", { align: "center", width: 480 })
        .run();
    };
    input.click();
  }, [editor, supabase, userId, articleKey]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL do link:", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const setFontSize = useCallback(
    (size: string) => {
      if (!editor) return;
      editor.chain().focus().setMark("textStyle", { fontSize: size }).run();
    },
    [editor]
  );

  const setImageAlign = useCallback(
    (align: ImageAlign) => {
      if (!editor || !editor.isActive("image")) return;
      editor.chain().focus().updateAttributes("image", { align }).run();
    },
    [editor]
  );

  const setImageWidth = useCallback(
    (width: number | null) => {
      if (!editor || !editor.isActive("image")) return;
      editor.chain().focus().updateAttributes("image", { width }).run();
    },
    [editor]
  );

  if (!editor) return null;

  const imageSelected = editor.isActive("image");
  const imageAlign = (editor.getAttributes("image").align as ImageAlign) || "center";

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--toq-border)] bg-[var(--toq-card)]">
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--toq-border)] bg-[var(--toq-input-bg)] p-2">
        <ToolbarButton
          title="Negrito"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          title="Itálico"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          title="Sublinhado"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-[var(--toq-border)]" />
        <ToolbarButton
          title="Lista com marcadores"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • Lista
        </ToolbarButton>
        <ToolbarButton
          title="Lista numerada"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. Lista
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-[var(--toq-border)]" />
        <ToolbarButton
          title="Alinhar à esquerda"
          active={
            imageSelected ? imageAlign === "left" : editor.isActive({ textAlign: "left" })
          }
          onClick={() => {
            if (imageSelected) setImageAlign("left");
            else editor.chain().focus().setTextAlign("left").run();
          }}
        >
          ⬅
        </ToolbarButton>
        <ToolbarButton
          title="Centralizar"
          active={
            imageSelected ? imageAlign === "center" : editor.isActive({ textAlign: "center" })
          }
          onClick={() => {
            if (imageSelected) setImageAlign("center");
            else editor.chain().focus().setTextAlign("center").run();
          }}
        >
          ↔
        </ToolbarButton>
        <ToolbarButton
          title="Alinhar à direita"
          active={
            imageSelected ? imageAlign === "right" : editor.isActive({ textAlign: "right" })
          }
          onClick={() => {
            if (imageSelected) setImageAlign("right");
            else editor.chain().focus().setTextAlign("right").run();
          }}
        >
          ➡
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-[var(--toq-border)]" />
        <select
          className="toq-input px-2 py-1 text-xs"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) setFontSize(e.target.value);
            e.target.value = "";
          }}
          aria-label="Tamanho da fonte"
        >
          <option value="">Tamanho</option>
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              title={`Cor ${color}`}
              onClick={() => editor.chain().focus().setColor(color).run()}
              className="h-5 w-5 rounded-full border border-[var(--toq-border)]"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <span className="mx-1 h-5 w-px bg-[var(--toq-border)]" />
        <ToolbarButton title="Inserir link" onClick={setLink}>
          Link
        </ToolbarButton>
        <ToolbarButton title="Inserir imagem" onClick={() => void insertImage()}>
          Foto
        </ToolbarButton>
      </div>

      {imageSelected && (
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--toq-border)] bg-[var(--toq-accent-soft)] px-2 py-1.5">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-[var(--toq-text-muted)]">
            Imagem
          </span>
          {IMAGE_SIZES.map((s) => (
            <ToolbarButton
              key={s.width}
              title={`Largura ${s.label}`}
              active={editor.getAttributes("image").width === s.width}
              onClick={() => setImageWidth(s.width)}
            >
              {s.label}
            </ToolbarButton>
          ))}
          <ToolbarButton title="Largura original" onClick={() => setImageWidth(null)}>
            Original
          </ToolbarButton>
          <span className="mx-1 text-[10px] text-[var(--toq-text-muted)]">
            ou arraste o canto da foto
          </span>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
