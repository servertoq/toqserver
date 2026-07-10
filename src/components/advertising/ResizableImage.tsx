"use client";

import { useCallback, useRef } from "react";
import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { INDENT_STEP_PX } from "./indentConstants";

export type ImageAlign = "left" | "center" | "right";

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const width = (node.attrs.width as number | null) ?? null;
  const align = ((node.attrs.align as ImageAlign) || "center") as ImageAlign;
  const indent = Number(node.attrs.indent ?? 0);

  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const img = imgRef.current;
      if (!img) return;

      const startX = e.clientX;
      const startWidth = img.getBoundingClientRect().width;

      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX;
        const next = Math.round(Math.min(900, Math.max(80, startWidth + delta)));
        updateAttributes({ width: next });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [updateAttributes]
  );

  return (
    <NodeViewWrapper
      as="div"
      className={`advertising-image-wrap advertising-image-wrap--${align}${selected ? " is-selected" : ""}`}
      data-drag-handle
      data-indent={indent || undefined}
      style={indent > 0 ? { paddingLeft: `${indent * INDENT_STEP_PX}px` } : undefined}
    >
      <div className="advertising-image-frame" style={width ? { width: `${width}px` } : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={node.attrs.src as string}
          alt={(node.attrs.alt as string) || ""}
          title={(node.attrs.title as string) || undefined}
          draggable={false}
        />
        {selected && (
          <button
            type="button"
            className="advertising-image-resize"
            title="Arraste para redimensionar"
            aria-label="Redimensionar imagem"
            onPointerDown={onResizeStart}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  name: "image",

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const attr = element.getAttribute("width");
          if (attr) {
            const n = parseInt(attr, 10);
            return Number.isFinite(n) ? n : null;
          }
          const styleW = element.style.width;
          if (styleW?.endsWith("px")) {
            const n = parseInt(styleW, 10);
            return Number.isFinite(n) ? n : null;
          }
          return null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: String(attributes.width) };
        },
      },
      align: {
        default: "center",
        parseHTML: (element) => {
          const data = element.getAttribute("data-align");
          if (data === "left" || data === "center" || data === "right") return data;
          const style = element.getAttribute("style") ?? "";
          if (style.includes("margin-left: auto") && style.includes("margin-right: 0")) return "right";
          if (style.includes("margin-left: 0") && style.includes("margin-right: auto")) return "left";
          if (style.includes("margin-left: auto") && style.includes("margin-right: auto")) return "center";
          return "center";
        },
        renderHTML: (attributes) => {
          const align = (attributes.align as ImageAlign) || "center";
          const indent = Number(attributes.indent ?? 0);
          let margin = "margin: 1rem auto;";
          if (align === "left") margin = "margin: 1rem auto 1rem 0;";
          if (align === "right") margin = "margin: 1rem 0 1rem auto;";
          if (indent > 0) {
            margin = `margin: 1rem auto 1rem ${indent * INDENT_STEP_PX}px;`;
            if (align === "right") {
              margin = `margin: 1rem 0 1rem ${indent * INDENT_STEP_PX}px;`;
            }
          }
          const widthStyle = attributes.width
            ? `width: ${attributes.width}px; max-width: 100%; height: auto;`
            : "max-width: 100%; height: auto;";
          return {
            "data-align": align,
            ...(indent > 0 ? { "data-indent": String(indent) } : {}),
            style: `display: block; ${widthStyle} ${margin}`,
          };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
