import { Extension, type CommandProps } from "@tiptap/core";
import { AllSelection, NodeSelection, TextSelection, type Transaction } from "@tiptap/pm/state";
import { INDENT_STEP_PX } from "./indentConstants";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

const INDENT_TYPES = ["paragraph", "heading", "image"] as const;
const MIN_LEVEL = 0;
const MAX_LEVEL = 8;

function clampIndent(level: number) {
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, level));
}

function setNodeIndent(tr: Transaction, pos: number, delta: number): Transaction {
  const node = tr.doc.nodeAt(pos);
  if (!node) return tr;
  if (!INDENT_TYPES.includes(node.type.name as (typeof INDENT_TYPES)[number])) return tr;

  const current = Number(node.attrs.indent ?? 0);
  const indent = clampIndent(current + delta);
  if (indent === current) return tr;

  return tr.setNodeMarkup(pos, node.type, { ...node.attrs, indent }, node.marks);
}

function updateIndentLevel(tr: Transaction, delta: number): Transaction {
  const { selection, doc } = tr;

  if (selection instanceof NodeSelection) {
    return setNodeIndent(tr, selection.from, delta);
  }

  if (!(selection instanceof TextSelection || selection instanceof AllSelection)) {
    return tr;
  }

  const { from, to } = selection;
  doc.nodesBetween(from, to, (node, pos) => {
    if (INDENT_TYPES.includes(node.type.name as (typeof INDENT_TYPES)[number])) {
      tr = setNodeIndent(tr, pos, delta);
      return false;
    }
    return true;
  });

  return tr;
}

export const Indent = Extension.create({
  name: "indent",

  addGlobalAttributes() {
    return [
      {
        types: [...INDENT_TYPES],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const data = element.getAttribute("data-indent");
              if (data) {
                const n = parseInt(data, 10);
                return Number.isFinite(n) ? clampIndent(n) : 0;
              }
              const ml = element.style.marginLeft;
              if (ml?.endsWith("px")) {
                const px = parseInt(ml, 10);
                if (Number.isFinite(px) && px > 0) {
                  return clampIndent(Math.round(px / INDENT_STEP_PX));
                }
              }
              return 0;
            },
            renderHTML: (attributes) => {
              const indent = Number(attributes.indent ?? 0);
              if (!indent) return {};
              return {
                "data-indent": String(indent),
                style: `margin-left: ${indent * INDENT_STEP_PX}px;`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    const apply =
      (delta: number) =>
      () =>
      ({ tr, state, dispatch, editor }: CommandProps) => {
        if (delta > 0 && editor.can().sinkListItem("listItem")) {
          return editor.commands.sinkListItem("listItem");
        }
        if (delta < 0 && editor.can().liftListItem("listItem")) {
          return editor.commands.liftListItem("listItem");
        }

        let transaction = tr.setSelection(state.selection);
        transaction = updateIndentLevel(transaction, delta);
        if (transaction.docChanged) {
          dispatch?.(transaction);
          return true;
        }
        // Ainda consome o Tab para não sair do editor
        return true;
      };

    return {
      indent: apply(1),
      outdent: apply(-1),
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      "Shift-Tab": () => this.editor.commands.outdent(),
    };
  },
});
