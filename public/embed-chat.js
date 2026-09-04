/**
 * Red Cherry Assistant embed script.
 *
 * Drop this just before </body> on any site (e.g. weekend-warrior.co.za):
 *
 *   <script>
 *     window.redCherryAssistantConfig = {
 *       origin: "https://riderapp.redcherryevents.co.za",
 *       position: "right", // "left" or "right"
 *       color: "#E11D48",    // launcher background
 *     };
 *   </script>
 *   <script src="https://riderapp.redcherryevents.co.za/embed-chat.js" async></script>
 */
(function () {
  "use strict";

  const cfg = window.redCherryAssistantConfig || {};
  const origin = cfg.origin || "https://riderapp.redcherryevents.co.za";
  const color = cfg.color || "#E11D48";
  const position = cfg.position === "left" ? "left" : "right";

  if (document.getElementById("red-cherry-assistant-root")) return;

  const isSmall = () => window.innerWidth < 640;

  const root = document.createElement("div");
  root.id = "red-cherry-assistant-root";
  root.setAttribute("aria-live", "polite");

  const panel = document.createElement("div");
  panel.id = "red-cherry-assistant-panel";
  panel.style.cssText = [
    "display: none",
    "position: fixed",
    "z-index: 999999",
    "overflow: hidden",
    "border-radius: 16px",
    "box-shadow: 0 20px 50px rgba(0,0,0,0.25)",
    "background: #fff",
    "border: 1px solid rgba(0,0,0,0.08)",
  ].join(";");

  const iframe = document.createElement("iframe");
  iframe.id = "red-cherry-assistant-frame";
  iframe.src = origin + "/embed/chat";
  iframe.title = "Red Cherry Assistant";
  iframe.setAttribute("allow", "clipboard-write");
  iframe.style.cssText = "width: 100%; height: 100%; border: 0; display: block;";

  panel.appendChild(iframe);
  root.appendChild(panel);

  const launcher = document.createElement("button");
  launcher.id = "red-cherry-assistant-launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Open Red Cherry assistant");
  launcher.style.cssText = [
    "position: fixed",
    "z-index: 999999",
    "bottom: 20px",
    position + ": 20px",
    "width: 56px",
    "height: 56px",
    "border-radius: 50%",
    "border: 0",
    "cursor: pointer",
    "background-color: " + color,
    "color: #fff",
    "box-shadow: 0 6px 20px rgba(0,0,0,0.25)",
    "display: grid",
    "place-items: center",
    "transition: transform 0.15s ease, box-shadow 0.15s ease",
  ].join(";");
  launcher.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  launcher.addEventListener("mouseenter", () => {
    launcher.style.transform = "scale(1.05)";
    launcher.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
  });
  launcher.addEventListener("mouseleave", () => {
    launcher.style.transform = "scale(1)";
    launcher.style.boxShadow = "0 6px 20px rgba(0,0,0,0.25)";
  });

  function layout() {
    const small = isSmall();
    if (small) {
      panel.style.width = "100vw";
      panel.style.height = "100dvh";
      panel.style.top = "0";
      panel.style.left = "0";
      panel.style.bottom = "auto";
      panel.style.right = "auto";
      panel.style.borderRadius = "0";
    } else {
      panel.style.width = "380px";
      panel.style.height = "600px";
      panel.style.maxHeight = "calc(100dvh - 100px)";
      panel.style.top = "auto";
      panel.style.bottom = "88px";
      panel.style.left = position === "left" ? "20px" : "auto";
      panel.style.right = position === "right" ? "20px" : "auto";
      panel.style.borderRadius = "16px";
    }
  }

  let open = false;
  function toggle() {
    open = !open;
    panel.style.display = open ? "block" : "none";
    if (open) {
      layout();
      setTimeout(() => iframe.focus(), 0);
    }
  }

  launcher.addEventListener("click", toggle);

  window.addEventListener("resize", layout);

  window.addEventListener("message", (event) => {
    if (event.origin !== origin) return;
    const data = event.data;
    if (data && typeof data === "object" && data.type === "red-cherry-assistant-close") {
      open = false;
      panel.style.display = "none";
    }
  });

  document.body.appendChild(root);
  document.body.appendChild(launcher);
  layout();
})();
