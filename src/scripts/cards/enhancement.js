import { restoreTextCards } from "./fallback.js";
export function enhanceTextCards(root, load = () => import("./physics.js")) {
  let disposed = false;
  let cleanup;
  if (root.dataset.state === "pending") root.dataset.state = "loading";
  else restoreTextCards(root);
  void Promise.resolve()
    .then(load)
    .then(({ mountTextCards }) => {
      if (!disposed && root.isConnected) cleanup = mountTextCards(root);
    })
    .catch(() => {
      if (!disposed) restoreTextCards(root);
    });
  return () => {
    disposed = true;
    try {
      cleanup?.();
    } finally {
      restoreTextCards(root);
    }
  };
}
