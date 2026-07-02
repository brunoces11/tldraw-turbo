import { createContext } from "react";
import type { Editor } from "tldraw";
import type { LocalFileEntry } from "./filesApi";

export interface FilesActionsContextValue {
  setEditor(editor: Editor): void;
  createDraft(): Promise<void>;
  openFile(id: string): Promise<void>;
  renameFile(id: string, name: string): Promise<void>;
  deleteFile(id: string): Promise<void>;
  downloadFile(id: string): void;
  reorderFiles(ids: string[]): Promise<void>;
}

export interface FilesContextValue extends FilesActionsContextValue {
  files: LocalFileEntry[];
  currentFile: LocalFileEntry | null;
  draftName: string;
  isDraft: boolean;
  isLoading: boolean;
}

export const FilesContext = createContext<FilesContextValue | null>(null);
export const FilesActionsContext = createContext<FilesActionsContextValue | null>(null);
