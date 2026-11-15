// Runs inline after the font definitions, before any body content is painted.
(() => {
  const root = document.documentElement;
  let timer;
  let settled = false;
  const events = ["pointerdown", "keydown", "focusin"];
  const finish = (state) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    root.dataset.fonts = state;
    for (const event of events) document.removeEventListener(event, interact, true);
    document.dispatchEvent(new Event("portfolio:fonts-settled"));
  };
  // Never leave a focused or clicked control with an invisible label.
  const interact = () => finish("fallback");
  try {
    if (!document.fonts?.load || matchMedia("(forced-colors: active)").matches) return;
    // Install the escape hatch before entering the pending state.
    timer = setTimeout(() => finish("fallback"), 1500);
    for (const event of events) document.addEventListener(event, interact, true);
    root.dataset.fonts = "loading";
    const required = [
      ...[300, 400, 500, 700].map((weight) =>
        document.fonts.load(`${weight} 16px "Gen Interface JP"`, "Aあ"),
      ),
      document.fonts.load('400 16px "Zen Kaku Gothic New"', "タ"),
    ];
    Promise.all(required).then((faces) => {
      finish(faces.every((result) => result.length && result.every((face) => face.status === "loaded"))
        ? "ready" : "fallback");
    }, () => finish("fallback"));
  } catch {
    finish("fallback");
  }
})();
