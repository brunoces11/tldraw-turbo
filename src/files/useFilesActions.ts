import { useContext } from "react";
import { FilesActionsContext } from "./FilesContextStore";

export function useFilesActions() {
  const context = useContext(FilesActionsContext);
  if (!context) {
    throw new Error("useFilesActions must be used inside FilesProvider");
  }
  return context;
}
