import { useContext } from "react";
import { FilesContext } from "./FilesContextStore";

export function useFiles() {
  const context = useContext(FilesContext);
  if (!context) {
    throw new Error("useFiles must be used inside FilesProvider");
  }
  return context;
}
