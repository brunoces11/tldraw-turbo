import {
  PORTRAIT_BREAKPOINT,
  TldrawUiToolbar,
  useBreakpoint,
  useEditor,
  useTldrawUiComponents,
  useTranslation,
  useValue,
} from "tldraw";
import { memo } from "react";
import { FileMenu } from "./FileMenu";

export const FilesMenuPanel = memo(function FilesMenuPanel() {
  const breakpoint = useBreakpoint();
  const msg = useTranslation();
  const { MainMenu, QuickActions, ActionsMenu, PageMenu } = useTldrawUiComponents();
  const editor = useEditor();
  const isSinglePageMode = useValue("isSinglePageMode", () => editor.options.maxPages <= 1, [editor]);
  const showQuickActions =
    editor.options.actionShortcutsLocation === "menu"
      ? true
      : editor.options.actionShortcutsLocation === "toolbar"
        ? false
        : breakpoint >= PORTRAIT_BREAKPOINT.TABLET;

  if (!MainMenu && !PageMenu && !showQuickActions) return null;

  return (
    <nav className="tlui-menu-zone">
      <div className="tlui-buttons__horizontal">
        {MainMenu && <MainMenu />}
        <FileMenu />
        {PageMenu && !isSinglePageMode && <PageMenu />}
        {showQuickActions ? (
          <TldrawUiToolbar className="tlui-buttons__horizontal" label={msg("actions-menu.title")}>
            {QuickActions && <QuickActions />}
            {ActionsMenu && <ActionsMenu />}
          </TldrawUiToolbar>
        ) : null}
      </div>
    </nav>
  );
});
