export function restoreTextCards(root) {
  root.dataset.active = "false";
  root.dataset.state = "static";
  for (const card of root.querySelectorAll("[data-card]")) {
    for (const property of ["opacity", "transform", "z-index", "will-change"])
      card.style.removeProperty(property);
  }
  root.querySelector("[data-skin]")?.replaceChildren();
  const controls = root.querySelector("[data-controls-container]");
  if (controls) controls.hidden = true;
}
