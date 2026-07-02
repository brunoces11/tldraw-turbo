import {
  Editor,
  parseTldrawJsonFile,
  serializeTldrawJson,
  type TLEditorSnapshot,
} from "tldraw";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { filesApi, type LocalFileEntry } from "./filesApi";
import { FilesContext, type FilesContextValue } from "./FilesContextStore";

function getNextCanvasName(files: LocalFileEntry[]) {
  const used = new Set(files.map((file) => file.name));
  let index = files.length + 1;
  while (used.has(`Canvas ${index}`)) index++;
  return `Canvas ${index}`;
}

function hasDocumentContent(editor: Editor) {
  return editor.store.allRecords().some((record) => record.typeName === "shape");
}

export function FilesProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<LocalFileEntry[]>([]);
  const [currentFile, setCurrentFile] = useState<LocalFileEntry | null>(null);
  const [draftName, setDraftName] = useState("Canvas 1");
  const [isLoading, setIsLoading] = useState(true);
  const editorRef = useRef<Editor | null>(null);
  const blankSnapshotRef = useRef<TLEditorSnapshot | null>(null);
  const isApplyingRemoteChangeRef = useRef(false);
  const currentFileRef = useRef<LocalFileEntry | null>(null);
  const draftNameRef = useRef(draftName);
  const filesRef = useRef(files);
  const lastSavedContentRef = useRef<string | null>(null);
  const autosaveCleanupRef = useRef<(() => void) | null>(null);
  const saveNowRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    currentFileRef.current = currentFile;
  }, [currentFile]);

  useEffect(() => {
    draftNameRef.current = draftName;
  }, [draftName]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    let isMounted = true;

    filesApi
      .list()
      .then(({ files }) => {
        if (!isMounted) return;
        setFiles(files);
        setDraftName(getNextCanvasName(files));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const setEditor = useCallback((nextEditor: Editor) => {
    if (editorRef.current === nextEditor) return;

    autosaveCleanupRef.current?.();
    editorRef.current = nextEditor;

    try {
      blankSnapshotRef.current = structuredClone(nextEditor.getSnapshot());
    } catch (error) {
      console.error("Failed to capture blank tldraw snapshot", error);
    }

    let timeout: number | null = null;
    let isDisposed = false;

    const saveCurrentDocument = async () => {
      if (isDisposed || isApplyingRemoteChangeRef.current) return;
      if (!hasDocumentContent(nextEditor) && !currentFileRef.current) return;

      const content = await serializeTldrawJson(nextEditor);
      if (content === lastSavedContentRef.current) return;

      const current = currentFileRef.current;

      if (current) {
        const { file } = await filesApi.save(current.id, content);
        lastSavedContentRef.current = content;
        setFiles((items) => items.map((item) => (item.id === file.id ? file : item)));
        setCurrentFile(file);
        return;
      }

      const { file } = await filesApi.create(draftNameRef.current, content);
      lastSavedContentRef.current = content;
      setFiles((items) => [...items, file]);
      setCurrentFile(file);
      setDraftName(file.name);
    };

    saveNowRef.current = saveCurrentDocument;

    const unsubscribe = nextEditor.store.listen(
      () => {
        if (isApplyingRemoteChangeRef.current) return;
        if (timeout) window.clearTimeout(timeout);
        timeout = window.setTimeout(() => {
          void saveCurrentDocument().catch((error) => {
            console.error("Failed to autosave file", error);
          });
        }, 800);
      },
      { source: "user", scope: "document" }
    );

    autosaveCleanupRef.current = () => {
      isDisposed = true;
      if (timeout) window.clearTimeout(timeout);
      saveNowRef.current = null;
      unsubscribe();
    };
  }, []);

  const loadBlankCanvas = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !blankSnapshotRef.current) return;

    isApplyingRemoteChangeRef.current = true;
    editor.loadSnapshot(blankSnapshotRef.current);
    editor.clearHistory();
    lastSavedContentRef.current = null;
    queueMicrotask(() => {
      isApplyingRemoteChangeRef.current = false;
    });
  }, []);

  const createDraft = useCallback(async () => {
    await saveNowRef.current?.();
    loadBlankCanvas();
    setCurrentFile(null);
    setDraftName(getNextCanvasName(filesRef.current));
  }, [loadBlankCanvas]);

  const openFile = useCallback(
    async (id: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      const { file, content } = await filesApi.open(id);
      const parsed = parseTldrawJsonFile({ json: content, schema: editor.store.schema });
      if (!parsed.ok) {
        throw new Error("Could not open tldraw file");
      }

      isApplyingRemoteChangeRef.current = true;
      editor.loadSnapshot(parsed.value.getStoreSnapshot());
      editor.clearHistory();
      lastSavedContentRef.current = content;
      setCurrentFile(file);
      setDraftName(file.name);
      queueMicrotask(() => {
        isApplyingRemoteChangeRef.current = false;
      });
    },
    []
  );

  const renameFile = useCallback(
    async (id: string, name: string) => {
      const { file } = await filesApi.rename(id, name);
      setFiles((items) => items.map((item) => (item.id === id ? file : item)));
      setCurrentFile((item) => (item?.id === id ? file : item));
      setDraftName(file.name);
    },
    []
  );

  const deleteFile = useCallback(
    async (id: string) => {
      const { files } = await filesApi.delete(id);
      setFiles(files);

      if (currentFileRef.current?.id === id) {
        setCurrentFile(null);
        setDraftName(getNextCanvasName(files));
        lastSavedContentRef.current = null;
        loadBlankCanvas();
      }
    },
    [loadBlankCanvas]
  );

  const reorderFiles = useCallback(async (ids: string[]) => {
    setFiles((items) => {
      const byId = new Map(items.map((item) => [item.id, item]));
      const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as LocalFileEntry[];
      return [...ordered, ...items.filter((item) => !ids.includes(item.id))];
    });

    const { files } = await filesApi.reorder(ids);
    setFiles(files);
  }, []);

  const downloadFile = useCallback((id: string) => {
    filesApi.download(id);
  }, []);

  useEffect(() => () => autosaveCleanupRef.current?.(), []);

  const value = useMemo<FilesContextValue>(
    () => ({
      files,
      currentFile,
      draftName,
      isDraft: !currentFile,
      isLoading,
      setEditor,
      createDraft,
      openFile,
      renameFile,
      deleteFile,
      downloadFile,
      reorderFiles,
    }),
    [
      files,
      currentFile,
      draftName,
      isLoading,
      setEditor,
      createDraft,
      openFile,
      renameFile,
      deleteFile,
      downloadFile,
      reorderFiles,
    ]
  );

  return <FilesContext.Provider value={value}>{children}</FilesContext.Provider>;
}
