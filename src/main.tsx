import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { setupPwa } from "./lib/pwa";
import "./index.css";

setupPwa();
createRoot(document.getElementById("root")!).render(<App />);
