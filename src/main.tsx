import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import TargetMode from "./components/target-mode/TargetMode";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <TargetMode />
  </StrictMode>,
);
