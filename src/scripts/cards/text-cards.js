import { enhanceTextCards } from "./enhancement.js";

for (const root of document.querySelectorAll("[data-text-cards]")) {
  enhanceTextCards(root);
}
