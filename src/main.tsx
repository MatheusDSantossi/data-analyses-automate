import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { FileProvider } from "./context/FileContext.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FileProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </FileProvider>
  </StrictMode>
);
