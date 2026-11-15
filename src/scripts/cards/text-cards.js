import { enhanceTextCards } from "./enhancement.js";

function startCards() {
  for (const root of document.querySelectorAll("[data-text-cards]")) {
    enhanceTextCards(root);
  }
}

if (document.documentElement.dataset.fonts === "loading") {
  document.addEventListener("portfolio:fonts-settled", startCards, { once: true });
} else {
  startCards();
}
