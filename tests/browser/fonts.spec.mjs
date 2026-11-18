import { test, expect } from "@playwright/test";

const fontPattern = "**/*.woff2";

test.beforeEach(async ({ context, baseURL }) => {
  const origin = new URL(baseURL).origin;
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
});

async function actualFonts(page, selector) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    const { root } = await session.send("DOM.getDocument");
    const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    return (await session.send("CSS.getPlatformFontsForNode", { nodeId })).fonts;
  } finally {
    await session.detach();
  }
}

async function holdFonts(context) {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await context.route(fontPattern, async (route) => {
    await gate;
    await route.continue();
  });
  return release;
}

for (const width of [375, 1280]) {
  test(`初回の文字は指定フォントで表示し、フォント要求は5本: ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const requests = [];
    page.on("request", (request) => {
      if (request.resourceType() === "font") requests.push(request.url());
    });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-fonts", "ready");
    expect((await actualFonts(page, "[data-logo-char]")).some((font) => font.familyName === "Zen Kaku Gothic New" && font.isCustomFont)).toBe(true);
    expect((await actualFonts(page, "#section01 h2")).some((font) => font.familyName === "Gen Interface JP" && font.isCustomFont)).toBe(true);
    expect(requests).toHaveLength(5);
    expect(new Set(requests).size).toBe(5);
    expect(await page.locator('link[href*="fonts.googleapis"], link[href*="jsdelivr"]').count()).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("fonts-ready.png") });
  });
}

test("0.5秒遅延時は代替字体を描画せず、成功後に文字と演出を表示する", async ({ context, page }) => {
  await page.addInitScript(() => localStorage.setItem("animation", "on"));
  const release = await holdFonts(context);
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-fonts", "loading");
    await expect(page.locator("[data-logo-char]").first()).toHaveCSS("-webkit-text-fill-color", "rgba(0, 0, 0, 0)");
    expect(await page.evaluate(() => document.querySelector("header h1").getAnimations({ subtree: true }).length)).toBe(0);
    await page.waitForTimeout(500);
    await expect(page.locator("html")).toHaveAttribute("data-fonts", "loading");
    release();
    await expect(page.locator("html")).toHaveAttribute("data-fonts", "ready");
    await expect(page.locator("header h1")).toHaveAttribute("data-revealed", "true");
    await expect(page.locator("[data-logo-char]").first()).not.toHaveCSS("-webkit-text-fill-color", "rgba(0, 0, 0, 0)");
  } finally {
    release();
  }
});

test("上限を超えたら本文を表示し、遅れて取得したフォントには切り替えない", async ({ context, page }) => {
  const release = await holdFonts(context);
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-fonts", "fallback", { timeout: 2500 });
    await expect(page.locator("#section01 h2")).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
    const before = await page.locator("#section01 h2").boundingBox();
    release();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("html")).toHaveAttribute("data-fonts", "fallback");
    expect(await page.locator("#section01 h2").boundingBox()).toEqual(before);
    expect((await actualFonts(page, "#section01 h2")).every((font) => !font.isCustomFont)).toBe(true);
  } finally {
    release();
  }
});

for (const failure of ["abort", "404"]) {
  test(`フォント取得失敗でも本文と設定が利用できる: ${failure}`, async ({ context, page }) => {
    await context.route(fontPattern, (route) => failure === "abort"
      ? route.abort() : route.fulfill({ status: 404, body: "Not found" }));
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-fonts", "fallback");
    await expect(page.getByRole("heading", { name: "自己紹介", exact: true })).toBeVisible();
    await page.locator("[data-theme-toggle]").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
}

test("待機中のキーボード操作で文字が即座に表示される", async ({ context, page }) => {
  const release = await holdFonts(context);
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-fonts", "loading");
    await page.keyboard.press("Tab");
    await expect(page.locator("html")).toHaveAttribute("data-fonts", "fallback");
    await expect(page.locator("[data-animation-toggle]")).toBeFocused();
    await expect(page.locator("[data-animation-toggle]")).not.toHaveCSS("-webkit-text-fill-color", "rgba(0, 0, 0, 0)");
  } finally {
    release();
  }
});

test("JSが無効でも本文を読める", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    await context.route(fontPattern, (route) => route.abort());
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute("data-fonts");
    await expect(page.locator("#section01 h2")).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
    await page.getByRole("button", { name: "コンテンツメニュー", exact: true }).click();
    await expect(page.locator("#fixed-nav-popover")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("フォントAPIの例外で非表示状態を残さない", async ({ context, page }) => {
  await context.addInitScript(() => {
    document.fonts.load = () => { throw new Error("Unavailable"); };
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-fonts", "fallback");
  await expect(page.locator("#section01 h2")).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
});
