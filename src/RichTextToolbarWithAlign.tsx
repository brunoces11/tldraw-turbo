import { getMarkRange, Range, EditorEvents as TextEditorEvents } from "@tiptap/core";
import { MarkType } from "@tiptap/pm/model";
import {
  Box,
  debounce,
  preventDefault,
  TiptapEditor,
  track,
  useEditor,
  useValue,
  TldrawUiButton,
  TldrawUiButtonIcon,
  TldrawUiContextualToolbar,
  TldrawUiInput,
  TldrawUiToolbarButton,
  useTranslation,
  useUiEvents,
} from "tldraw";
import { useCallback, useEffect, useRef, useState } from "react";

type TextAlignValue = "start" | "middle" | "end";

export const RichTextToolbarWithAlign = track(function RichTextToolbarWithAlign() {
  const editor = useEditor();
  const textEditor = useValue("textEditor", () => editor.getRichTextEditor(), [editor]);

  if (editor.getInstanceState().isCoarsePointer || !textEditor) return null;

  return <ContextualToolbarInner textEditor={textEditor} />;
});

function ContextualToolbarInner({ textEditor }: { textEditor: TiptapEditor }) {
  const { isEditingLink, onEditLinkStart, onEditLinkClose } = useEditingLinkBehavior(textEditor);
  const [currentSelection, setCurrentSelection] = useState<Range | null>(null);
  const previousSelectionBounds = useRef<Box | undefined>(undefined);
  const isMousingDown = useIsMousingDownOnTextEditor(textEditor);
  const msg = useTranslation();

  const getSelectionBounds = useCallback(() => {
    if (isEditingLink) {
      return previousSelectionBounds.current;
    }

    const selection = window.getSelection();
    if (!currentSelection || !selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const rangeBoxes: Box[] = [];
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      rangeBoxes.push(rectToBox(range.getBoundingClientRect()));
    }

    const bounds = Box.Common(rangeBoxes);
    previousSelectionBounds.current = bounds;
    return bounds;
  }, [currentSelection, isEditingLink]);

  useEffect(() => {
    const handleSelectionUpdate = ({ editor: nextTextEditor }: TextEditorEvents["selectionUpdate"]) =>
      setCurrentSelection(nextTextEditor.state.selection);
    textEditor.on("selectionUpdate", handleSelectionUpdate);
    handleSelectionUpdate({ editor: textEditor } as TextEditorEvents["selectionUpdate"]);
    return () => {
      textEditor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [textEditor]);

  return (
    <TldrawUiContextualToolbar
      className="tlui-rich-text__toolbar"
      getSelectionBounds={getSelectionBounds}
      isMousingDown={isMousingDown}
      changeOnlyWhenYChanges={true}
      label={msg("tool.rich-text-toolbar-title")}
    >
      {isEditingLink ? (
        <RichTextLinkEditor textEditor={textEditor} onClose={onEditLinkClose} />
      ) : (
        <RichTextToolbarContent textEditor={textEditor} onEditLinkStart={onEditLinkStart} />
      )}
    </TldrawUiContextualToolbar>
  );
}

function RichTextToolbarContent({
  textEditor,
  onEditLinkStart,
}: {
  textEditor: TiptapEditor;
  onEditLinkStart(): void;
}) {
  const editor = useEditor();
  const trackEvent = useUiEvents();
  const msg = useTranslation();
  const source = "rich-text-menu";

  const [, setTick] = useState(0);

  useEffect(function forceUpdateWhenContentChanges() {
    function forceUpdate() {
      setTick((value) => value + 1);
    }
    textEditor.on("update", forceUpdate);
    textEditor.on("selectionUpdate", forceUpdate);

    return () => {
      textEditor.off("update", forceUpdate);
      textEditor.off("selectionUpdate", forceUpdate);
    };
  }, [textEditor]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isAccelKey(event) && event.shiftKey && event.key === "k") {
        event.preventDefault();
        onEditLinkStart();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onEditLinkStart]);

  const currentAlign = useValue(
    "editing shape text align",
    () => {
      const shape = editor.getEditingShape();
      if (!shape) return null;
      const props = shape.props as { textAlign?: TextAlignValue; align?: TextAlignValue };
      if (shape.type === "text") return props.textAlign ?? null;
      if ("align" in props) return props.align ?? null;
      return null;
    },
    [editor]
  );

  const formattingActions = [
    {
      name: "bold",
      isActive: textEditor.isActive("bold"),
      onSelect() {
        trackEvent("rich-text", { operation: "bold" as any, source });
        ((textEditor.chain().focus() as any).toggleBold() as any).run();
      },
    },
    {
      name: "italic",
      isActive: textEditor.isActive("italic"),
      onSelect() {
        trackEvent("rich-text", { operation: "italic" as any, source });
        ((textEditor.chain().focus() as any).toggleItalic() as any).run();
      },
    },
    {
      name: "code",
      isActive: textEditor.isActive("code"),
      onSelect() {
        trackEvent("rich-text", { operation: "code" as any, source });
        ((textEditor.chain().focus() as any).toggleCode() as any).run();
      },
    },
    {
      name: "link",
      isActive: textEditor.isActive("link"),
      onSelect() {
        onEditLinkStart();
      },
    },
    {
      name: "bulletList",
      isActive: textEditor.isActive("bulletList"),
      onSelect() {
        trackEvent("rich-text", { operation: "bulletList" as any, source });
        ((textEditor.chain().focus() as any).toggleBulletList() as any).run();
      },
    },
    {
      name: "highlight",
      isActive: textEditor.isActive("highlight"),
      onSelect() {
        trackEvent("rich-text", { operation: "highlight" as any, source });
        ((textEditor.chain().focus() as any).toggleHighlight() as any).run();
      },
    },
  ] as const;

  const alignActions: Array<{
    value: TextAlignValue;
    icon: "text-align-left" | "text-align-center" | "text-align-right";
    title: string;
  }> = [
    { value: "start", icon: "text-align-left", title: msg("action.align-left") },
    { value: "middle", icon: "text-align-center", title: msg("action.align-center-horizontal") },
    { value: "end", icon: "text-align-right", title: msg("action.align-right") },
  ];

  const applyTextAlign = useCallback(
    (value: TextAlignValue) => {
      const shape = editor.getEditingShape();
      if (!shape) return;

      editor.run(() => {
        editor.markHistoryStoppingPoint(`text-align:${value}`);
        if (shape.type === "text") {
          editor.updateShapes([{ id: shape.id, type: shape.type, props: { textAlign: value } }]);
        } else if ("align" in shape.props) {
          editor.updateShapes([{ id: shape.id, type: shape.type, props: { align: value } }]);
        }
      });

      trackEvent("rich-text", { operation: `align-${value}` as any, source });
      textEditor.commands.focus();
    },
    [editor, textEditor, trackEvent]
  );

  return (
    <>
      {formattingActions.map(({ name, isActive, onSelect }) => (
        <TldrawUiToolbarButton
          key={name}
          title={msg(`tool.rich-text-${name}`)}
          data-testid={`rich-text.${name}`}
          type="icon"
          isActive={isActive}
          onPointerDown={preventDefault}
          onClick={onSelect}
          role="option"
          aria-pressed={isActive}
        >
          <TldrawUiButtonIcon small icon={name} />
        </TldrawUiToolbarButton>
      ))}
      {alignActions.map(({ value, icon, title }) => (
        <TldrawUiToolbarButton
          key={value}
          title={title}
          data-testid={`rich-text.align-${value}`}
          type="icon"
          isActive={currentAlign === value}
          onPointerDown={preventDefault}
          onClick={() => applyTextAlign(value)}
          role="option"
          aria-pressed={currentAlign === value}
          disabled={currentAlign === null}
        >
          <TldrawUiButtonIcon small icon={icon} />
        </TldrawUiToolbarButton>
      ))}
    </>
  );
}

function RichTextLinkEditor({
  textEditor,
  onClose,
}: {
  textEditor: TiptapEditor;
  onClose(): void;
}) {
  const editor = useEditor();
  const [value, setValue] = useState(
    textEditor.isActive("link") ? textEditor.getAttributes("link").href ?? "" : ""
  );
  const msg = useTranslation();
  const ref = useRef<HTMLInputElement>(null);
  const trackEvent = useUiEvents();
  const source = "rich-text-menu";
  const linkifiedValue = value.startsWith("http") ? value : `https://${value}`;

  useEffect(() => {
    ref.current?.focus();
  }, [value]);

  const handleLinkComplete = (link: string) => {
    trackEvent("rich-text", { operation: "link-edit" as any, source });
    if (!link.startsWith("http://") && !link.startsWith("https://")) {
      link = `https://${link}`;
    }

    (textEditor.commands as any).setLink({ href: link });
    if (editor.getInstanceState().isCoarsePointer) {
      textEditor.commands.blur();
    } else {
      textEditor.commands.focus();
    }
    onClose();
  };

  const handleVisitLink = () => {
    trackEvent("rich-text", { operation: "link-visit" as any, source });
    window.open(linkifiedValue, "_blank", "noopener, noreferrer");
    onClose();
  };

  const handleRemoveLink = () => {
    trackEvent("rich-text", { operation: "link-remove" as any, source });
    (((textEditor.chain() as any).unsetLink() as any).focus() as any).run();
    onClose();
  };

  return (
    <>
      <TldrawUiInput
        ref={ref}
        data-testid="rich-text.link-input"
        className="tlui-rich-text__toolbar-link-input"
        value={value}
        onValueChange={setValue}
        onComplete={handleLinkComplete}
        onCancel={onClose}
        placeholder="example.com"
      />
      <TldrawUiButton
        className="tlui-rich-text__toolbar-link-visit"
        title={msg("tool.rich-text-link-visit")}
        type="icon"
        onPointerDown={preventDefault}
        onClick={handleVisitLink}
        disabled={!value}
      >
        <TldrawUiButtonIcon small icon="external-link" />
      </TldrawUiButton>
      <TldrawUiButton
        className="tlui-rich-text__toolbar-link-remove"
        title={msg("tool.rich-text-link-remove")}
        data-testid="rich-text.link-remove"
        type="icon"
        onPointerDown={preventDefault}
        onClick={handleRemoveLink}
      >
        <TldrawUiButtonIcon small icon="trash" />
      </TldrawUiButton>
    </>
  );
}

function useEditingLinkBehavior(textEditor?: TiptapEditor) {
  const [isEditingLink, setIsEditingLink] = useState(false);

  useEffect(() => {
    if (!textEditor) {
      setIsEditingLink(false);
      return;
    }

    const handleClick = () => {
      const isLinkActive = textEditor.isActive("link");
      setIsEditingLink(isLinkActive);
    };

    textEditor.view.dom.addEventListener("click", handleClick);
    return () => {
      textEditor.view.dom.removeEventListener("click", handleClick);
    };
  }, [textEditor, isEditingLink]);

  useEffect(() => {
    if (!textEditor) return;

    if (textEditor.isActive("link")) {
      try {
        const { from, to } = getMarkRange(
          textEditor.state.doc.resolve(textEditor.state.selection.from),
          textEditor.schema.marks.link as MarkType
        ) as Range;
        if (textEditor.state.selection.empty) {
          textEditor.commands.setTextSelection({ from, to });
        }
      } catch {
        // Ignore invalid mark ranges during full-document selections.
      }
    }
  }, [textEditor, isEditingLink]);

  const onEditLinkStart = useCallback(() => {
    setIsEditingLink(true);
  }, []);

  const onEditLinkClose = useCallback(() => {
    setIsEditingLink(false);
    if (!textEditor) return;
    const from = textEditor.state.selection.from;
    textEditor.commands.setTextSelection({ from, to: from });
  }, [textEditor]);

  return { isEditingLink, onEditLinkStart, onEditLinkClose };
}

function useIsMousingDownOnTextEditor(textEditor: TiptapEditor) {
  const [isMousingDown, setIsMousingDown] = useState(false);

  useEffect(() => {
    const handlePointingStateChange = debounce(({ isPointing }: { isPointing: boolean }) => {
      setIsMousingDown(isPointing);
    }, 16);
    const handlePointingDown = () => handlePointingStateChange({ isPointing: true });
    const handlePointingUp = () => handlePointingStateChange({ isPointing: false });

    const touchDownEvents = ["touchstart", "pointerdown", "mousedown"];
    const touchUpEvents = ["touchend", "pointerup", "mouseup"];
    touchDownEvents.forEach((eventName) => {
      textEditor.view.dom.addEventListener(eventName, handlePointingDown);
    });
    touchUpEvents.forEach((eventName) => {
      document.body.addEventListener(eventName, handlePointingUp);
    });

    return () => {
      touchDownEvents.forEach((eventName) => {
        textEditor.view.dom.removeEventListener(eventName, handlePointingDown);
      });
      touchUpEvents.forEach((eventName) => {
        document.body.removeEventListener(eventName, handlePointingUp);
      });
    };
  }, [textEditor]);

  return isMousingDown;
}

function rectToBox(rect: DOMRect): Box {
  return new Box(rect.x, rect.y, rect.width, rect.height);
}

function isAccelKey(event: KeyboardEvent) {
  return event.metaKey || event.ctrlKey;
}
