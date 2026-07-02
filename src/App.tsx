import {
  DefaultToolbar,
  DefaultToolbarContent,
  Editor,
  Tldraw,
  TldrawUiMenuItem,
  useEditor,
  useIsToolSelected,
  useTools,
} from "tldraw";
import { useMemo, useRef, useState } from "react";
import "tldraw/tldraw.css";
import { InFrontOfTheCanvas } from "./InFrontOfTheCanvas";
import { CustomQuickActions } from "./CustomQuickActions";
import { getUniqueGroupIdsInOrder } from "./getUniqueGroupIdsInOrder";
import { getNewActions } from "./getNewActions";
import { assetUrls } from "./assetUrls";
import { SharePanel } from "./SharePanel";
import { WelcomeDialogHandler } from "./WelcomeDialog/WelcomeDialogHandler";
import { IconTool } from "./IconTool/IconTool";
import { IconDialogHandler } from "./IconTool/IconDialogHandler";
import { extendWithIconTool } from "./IconTool/extendWithIconTool.tsx";
import { LineWidthStylePanel } from "./LineWidthStylePanel";
import { FilesProvider } from "./files/FilesContext";
import { FilesMenuPanel } from "./files/FilesMenuPanel";
import { useFilesActions } from "./files/useFilesActions";

export default function App() {
  return (
    <FilesProvider>
      <TldrawApp />
    </FilesProvider>
  );
}

function TldrawApp() {
  const [isPresentationModeActive, setIsPresentationModeActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPresentationEditModeActive, setIsPresentationEditModeActive] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const { setEditor } = useFilesActions();

  const togglePresentationMode = () => {
    setIsPresentationModeActive((prev) => {
      if (!prev && editorRef.current) {
        editorRef.current.selectNone();
      }
      return !prev;
    });
    setIsPresentationEditModeActive(false);
    setCurrentStep(0);
  };

  const togglePresentationEditMode = () => {
    setIsPresentationEditModeActive((prev) => !prev);
    setIsPresentationModeActive(false);
  };

  const components = useMemo(
    () => ({
      ...(isPresentationEditModeActive ? { InFrontOfTheCanvas } : {}),
      MenuPanel: FilesMenuPanel,
      StylePanel: isPresentationModeActive ? null : LineWidthStylePanel,
      Toolbar: (props: Parameters<typeof DefaultToolbar>[0]) => {
        const tools = useTools();
        const isIconSelected = useIsToolSelected(tools["icon"]);
        return (
          <DefaultToolbar {...props}>
            <TldrawUiMenuItem {...tools["icon"]} isSelected={isIconSelected} />
            <DefaultToolbarContent />
          </DefaultToolbar>
        );
      },
      QuickActions: () => {
        const editor = useEditor();
        const uniqueGroupIdsInOrder = getUniqueGroupIdsInOrder(editor);
        const maxStep = uniqueGroupIdsInOrder.length - 1;
        return (
          <CustomQuickActions
            currentStep={currentStep}
            maxStep={maxStep}
            isPresentationEditModeActive={isPresentationEditModeActive}
          />
        );
      },
      SharePanel,
      TopPanel: () => (
        <>
          <WelcomeDialogHandler />
          <IconDialogHandler />
        </>
      ),
    }),
    [currentStep, isPresentationEditModeActive, isPresentationModeActive]
  );

  const overrides = useMemo(
    () => ({
      tools(editor: Editor, tools: Parameters<typeof extendWithIconTool>[1]) {
        return extendWithIconTool(editor, tools);
      },
      actions: (_editor: Editor, actions: ReturnType<typeof getNewActions> & Record<string, unknown>) => {
        const uniqueGroupIdsInOrder = getUniqueGroupIdsInOrder(_editor);
        const maxStep = uniqueGroupIdsInOrder.length - 1;

        const newActions = getNewActions({
          togglePresentationEditMode,
          togglePresentationMode,
          isPresentationModeActive,
          maxStep,
          setCurrentStep,
        });

        return {
          ...actions,
          ...newActions,
        };
      },
    }),
    [isPresentationModeActive]
  );

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        onUiEvent={(event) => {
          if (event === "change-page") {
            setCurrentStep(0);
          }
        }}
        tools={[IconTool]}
        overrides={overrides}
        components={components}
        getShapeVisibility={(shape, editor) => {
          if (!isPresentationModeActive) {
            return "visible";
          }
          const uniqueGroupIdsInOrder = getUniqueGroupIdsInOrder(editor);
          const groupId = uniqueGroupIdsInOrder[currentStep];
          return Number(shape.meta.groupId) > groupId ? "hidden" : "visible";
        }}
        assetUrls={assetUrls}
        onMount={(editor) => {
          editorRef.current = editor;
          window.setTimeout(() => setEditor(editor), 0);
          editor.getInitialMetaForShape = () => {
            return {
              groupId: 0,
            };
          };
        }}
      />
    </div>
  );
}
