import {
  TldrawUiButton,
  TldrawUiButtonCheck,
  TldrawUiButtonIcon,
  TldrawUiButtonLabel,
  TldrawUiDropdownMenuContent,
  TldrawUiDropdownMenuRoot,
  TldrawUiDropdownMenuTrigger,
  TldrawUiInput,
  TldrawUiMenuContextProvider,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  TldrawUiPopover,
  TldrawUiPopoverContent,
  TldrawUiPopoverTrigger,
  useMenuIsOpen,
} from "tldraw";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFiles } from "./useFiles";
import type { LocalFileEntry } from "./filesApi";

const ITEM_HEIGHT = 36;

export function FileMenu() {
  const {
    files,
    currentFile,
    draftName,
    createDraft,
    openFile,
    renameFile,
    reorderFiles,
    isLoading,
  } = useFiles();
  const [isEditing, setIsEditing] = useState(false);
  const [isOpen, onOpenChange] = useMenuIsOpen("file-menu", () => setIsEditing(false));
  const rSortableContainer = useRef<HTMLDivElement>(null);
  const rMutables = useRef({
    status: "idle" as "idle" | "pointing" | "dragging",
    pointing: null as { id: string; index: number } | null,
    startY: 0,
    startIndex: 0,
    dragIndex: 0,
  });
  const [sortablePositionItems, setSortablePositionItems] = useState(
    Object.fromEntries(
      files.map((file, index) => [file.id, { y: index * ITEM_HEIGHT, offsetY: 0 }])
    )
  );

  const activeName = currentFile?.name ?? draftName;

  useLayoutEffect(() => {
    setSortablePositionItems(
      Object.fromEntries(
        files.map((file, index) => [file.id, { y: index * ITEM_HEIGHT, offsetY: 0 }])
      )
    );
  }, [files]);

  useEffect(() => {
    if (!isOpen || !currentFile) return;

    requestAnimationFrame(() => {
      const item = document.querySelector(`[data-fileid="${currentFile.id}"]`) as HTMLDivElement | null;
      if (!item) return;

      item.querySelector("button")?.focus();
      const container = rSortableContainer.current;
      if (!container) return;

      const itemTop = item.offsetTop;
      const itemBottom = itemTop + ITEM_HEIGHT;
      const visibleTop = container.scrollTop;
      const visibleBottom = container.scrollTop + container.offsetHeight;

      if (itemTop < visibleTop) container.scrollTo({ top: itemTop });
      if (itemBottom > visibleBottom) container.scrollTo({ top: itemBottom - container.offsetHeight });
    });
  }, [currentFile, isOpen]);

  const toggleEditing = useCallback(() => {
    setIsEditing((value) => !value);
  }, []);

  const handleCreateFileClick = useCallback(() => {
    void createDraft();
    setIsEditing(false);
  }, [createDraft]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const { id, index } = event.currentTarget.dataset;
      if (!id || !index) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      const current = sortablePositionItems[id];
      const dragY = current?.y ?? Number(index) * ITEM_HEIGHT;

      rMutables.current.status = "pointing";
      rMutables.current.pointing = { id, index: Number(index) };
      rMutables.current.startY = event.clientY;
      rMutables.current.startIndex = Math.max(
        0,
        Math.min(Math.round(dragY / ITEM_HEIGHT), files.length - 1)
      );
    },
    [files.length, sortablePositionItems]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const mut = rMutables.current;
      if (mut.status === "pointing" && Math.abs(event.clientY - mut.startY) > 5) {
        mut.status = "dragging";
      }

      if (mut.status !== "dragging" || !mut.pointing) return;

      const current = sortablePositionItems[mut.pointing.id];
      const offsetY = event.clientY - mut.startY;
      const dragY = (current?.y ?? mut.pointing.index * ITEM_HEIGHT) + offsetY;
      const dragIndex = Math.max(0, Math.min(Math.round(dragY / ITEM_HEIGHT), files.length - 1));
      const next = { ...sortablePositionItems };

      next[mut.pointing.id] = {
        y: current?.y ?? mut.pointing.index * ITEM_HEIGHT,
        offsetY,
      };

      if (dragIndex !== mut.dragIndex) {
        mut.dragIndex = dragIndex;

        for (let index = 0; index < files.length; index++) {
          const file = files[index];
          if (file.id === mut.pointing.id) continue;

          let y = index * ITEM_HEIGHT;
          if (dragIndex < mut.startIndex && dragIndex <= index && index < mut.startIndex) {
            y = (index + 1) * ITEM_HEIGHT;
          } else if (dragIndex > mut.startIndex && dragIndex >= index && index > mut.startIndex) {
            y = (index - 1) * ITEM_HEIGHT;
          }

          next[file.id] = { y, offsetY: 0 };
        }
      }

      setSortablePositionItems(next);
    },
    [files, sortablePositionItems]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const mut = rMutables.current;
      event.currentTarget.releasePointerCapture(event.pointerId);

      if (mut.status === "dragging" && mut.pointing) {
        const next = [...files];
        const [item] = next.splice(mut.pointing.index, 1);
        next.splice(mut.dragIndex, 0, item);
        void reorderFiles(next.map((file) => file.id));
      }

      mut.status = "idle";
      mut.pointing = null;
    },
    [files, reorderFiles]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== "Escape") return;
      rMutables.current.status = "idle";
      setSortablePositionItems(
        Object.fromEntries(
          files.map((file, index) => [file.id, { y: index * ITEM_HEIGHT, offsetY: 0 }])
        )
      );
    },
    [files]
  );

  return (
    <TldrawUiPopover id="files" onOpenChange={onOpenChange} open={isOpen}>
      <TldrawUiPopoverTrigger>
        <TldrawUiButton
          type="menu"
          title={activeName}
          data-testid="file-menu.button"
          className="tlui-page-menu__trigger"
        >
          <div className="tlui-page-menu__name">{activeName}</div>
          <TldrawUiButtonIcon icon="chevron-down" small />
        </TldrawUiButton>
      </TldrawUiPopoverTrigger>
      <TldrawUiPopoverContent side="bottom" align="start" sideOffset={0} disableEscapeKeyDown={isEditing}>
        <div className="tlui-page-menu__wrapper">
          <div className="tlui-page-menu__header">
            <div className="tlui-page-menu__header__title">Files</div>
            <div className="tlui-buttons__horizontal">
              <TldrawUiButton
                type="icon"
                data-testid="file-menu.edit"
                title={isEditing ? "Done" : "Edit"}
                onClick={toggleEditing}
                disabled={files.length === 0}
              >
                <TldrawUiButtonIcon icon={isEditing ? "check" : "edit"} />
              </TldrawUiButton>
              <TldrawUiButton
                type="icon"
                data-testid="file-menu.create"
                title="Create new file"
                onClick={handleCreateFileClick}
                disabled={isLoading}
              >
                <TldrawUiButtonIcon icon="plus" />
              </TldrawUiButton>
            </div>
          </div>
          <div
            data-testid="file-menu.list"
            className="tlui-page-menu__list tlui-menu__group"
            style={{ height: Math.max(ITEM_HEIGHT * files.length + 4, ITEM_HEIGHT + 4) }}
            ref={rSortableContainer}
          >
            {files.map((file, index) => {
              const position = sortablePositionItems[file.id] ?? {
                y: index * ITEM_HEIGHT,
                offsetY: 0,
              };

              return isEditing ? (
                <div
                  key={`${file.id}_editing`}
                  data-testid="file-menu.item"
                  data-fileid={file.id}
                  className="tlui-page_menu__item__sortable"
                  style={{
                    zIndex: file.id === currentFile?.id ? 888 : index,
                    transform: `translate(0px, ${position.y + position.offsetY}px)`,
                  }}
                >
                  <TldrawUiButton
                    type="icon"
                    tabIndex={-1}
                    className="tlui-page_menu__item__sortable__handle"
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerMove={handlePointerMove}
                    onKeyDown={handleKeyDown}
                    data-id={file.id}
                    data-index={index}
                  >
                    <TldrawUiButtonIcon icon="drag-handle-dots" />
                  </TldrawUiButton>
                  <div className="tlui-page_menu__item__sortable__title" style={{ height: ITEM_HEIGHT }}>
                    <FileItemInput
                      file={file}
                      isCurrentFile={file.id === currentFile?.id}
                      onRename={renameFile}
                      onComplete={() => setIsEditing(false)}
                      onCancel={() => setIsEditing(false)}
                    />
                  </div>
                </div>
              ) : (
                <div
                  key={file.id}
                  data-fileid={file.id}
                  data-testid="file-menu.item"
                  className="tlui-page-menu__item"
                >
                  <TldrawUiButton
                    type="normal"
                    className="tlui-page-menu__item__button"
                    onClick={() => void openFile(file.id)}
                    onDoubleClick={toggleEditing}
                    title="Open file"
                  >
                    <TldrawUiButtonCheck checked={file.id === currentFile?.id} />
                    <TldrawUiButtonLabel>{file.name}</TldrawUiButtonLabel>
                  </TldrawUiButton>
                  <div className="tlui-page_menu__item__submenu">
                    <FileItemSubmenu file={file} index={index} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </TldrawUiPopoverContent>
    </TldrawUiPopover>
  );
}

function FileItemInput({
  file,
  isCurrentFile,
  onRename,
  onCancel,
  onComplete,
}: {
  file: LocalFileEntry;
  isCurrentFile: boolean;
  onRename(id: string, name: string): Promise<void>;
  onCancel(): void;
  onComplete(): void;
}) {
  const [name, setName] = useState(file.name);

  return (
    <TldrawUiInput
      className="tlui-page-menu__item__input"
      defaultValue={file.name}
      onValueChange={setName}
      onComplete={() => {
        void onRename(file.id, name).finally(onComplete);
      }}
      onCancel={onCancel}
      shouldManuallyMaintainScrollPositionWhenFocused
      autoFocus={isCurrentFile}
      autoSelect
    />
  );
}

function FileItemSubmenu({ file, index }: { file: LocalFileEntry; index: number }) {
  const { deleteFile, downloadFile } = useFiles();

  return (
    <TldrawUiDropdownMenuRoot id={`file item submenu ${index}`}>
      <TldrawUiDropdownMenuTrigger>
        <TldrawUiButton type="icon" title="Menu">
          <TldrawUiButtonIcon icon="dots-vertical" small />
        </TldrawUiButton>
      </TldrawUiDropdownMenuTrigger>
      <TldrawUiDropdownMenuContent alignOffset={0} side="right" sideOffset={-4}>
        <TldrawUiMenuContextProvider type="menu" sourceId="page-menu">
          <TldrawUiMenuGroup id="modify">
            <TldrawUiMenuItem id="download" label="Download" iconLeft="download" onSelect={() => downloadFile(file.id)} />
          </TldrawUiMenuGroup>
          <TldrawUiMenuGroup id="delete">
            <TldrawUiMenuItem id="delete" label="Delete" iconLeft="trash" onSelect={() => void deleteFile(file.id)} />
          </TldrawUiMenuGroup>
        </TldrawUiMenuContextProvider>
      </TldrawUiDropdownMenuContent>
    </TldrawUiDropdownMenuRoot>
  );
}
