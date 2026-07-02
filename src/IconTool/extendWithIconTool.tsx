import { Editor, TLUiToolsContextType } from "tldraw";
import { ScalableNoteIcon } from "../ScalableNoteTool/ScalableNoteIcon";

export function extendWithIconTool(editor: Editor, tools: TLUiToolsContextType) {
  tools.icon = {
    id: "icon",
    icon: "icon-icon",
    label: "Icon",
    kbd: "i",
    onSelect: () => {
      editor.setCurrentTool("icon");
    },
  };
  tools["scalable-note"] = {
    id: "scalable-note",
    icon: <ScalableNoteIcon />,
    label: "Scalable sticker",
    kbd: "shift+n",
    onSelect: () => {
      editor.setCurrentTool("scalable-note");
    },
  };
  return tools;
}
