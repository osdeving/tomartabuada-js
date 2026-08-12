import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "katex/dist/katex.min.css";
import "./styles.css";

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

  window.addEventListener("load", async () => {
    const appBaseUrl = new URL(import.meta.env.BASE_URL, window.location.href);
    const serviceWorkerUrl = new URL("sw.js", appBaseUrl);

    try {
      const registration = await navigator.serviceWorker.register(
        serviceWorkerUrl,
        {
          scope: appBaseUrl.href,
          updateViaCache: "none",
        },
      );

      // Check for a new worker on every fresh session without delaying the app.
      void registration.update();
    } catch (error) {
      console.error("Não foi possível ativar o modo offline.", error);
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

registerServiceWorker();
