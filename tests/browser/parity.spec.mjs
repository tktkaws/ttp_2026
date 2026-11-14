import { test, expect } from "@playwright/test";
const referenceURL = process.env.TTP_REFERENCE_URL;
test.skip(
  !referenceURL,
  "Set TTP_REFERENCE_URL to compare against the original site.",
);

for (const width of [320, 768, 1280, 1536]) {
  test(`original layout parity ${width}`, async ({
    browser,
    baseURL,
  }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    await context.route("**/*", (route) =>
      [new URL(baseURL).origin, new URL(referenceURL).origin].includes(
        new URL(route.request().url()).origin,
      )
        ? route.continue()
        : route.abort(),
    );
    const snapshot = async (url, name) => {
      const page = await context.newPage();
      await page.goto(url);
      await page.waitForFunction(
        () => document.querySelector("#fixed-nav").dataset.enhanced === "true",
      );
      await page.evaluate(() =>
        Promise.all(
          [...document.images].map((image) => image.decode().catch(() => {})),
        ),
      );
      for (const image of await page.locator('img[src^="/"]').all()) {
        expect(
          await image.evaluate((element) => element.naturalWidth),
        ).toBeGreaterThan(0);
      }
      await page.screenshot({
        path: testInfo.outputPath(`${name}-${width}.png`),
        fullPage: true,
      });
      const result = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            "h1, h2, h3, main p, section, footer, [data-card], [data-card] img, [data-menu-button], [data-preference-controls]",
          ),
        ].map((el) => {
          const rect = el.getBoundingClientRect(),
            style = getComputedStyle(el);
          return {
            tag: el.tagName,
            text: el.textContent.replace(/\s/g, ""),
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            font: style.fontSize,
            lineHeight: style.lineHeight,
            color: style.color,
            background: style.backgroundColor,
          };
        }),
      );
      await page.close();
      return result;
    };
    const source = await snapshot(referenceURL, "original");
    const target = await snapshot(baseURL, "replica");
    const diffs = target.flatMap((item, i) =>
      Object.keys(item)
        .filter((key) =>
          typeof item[key] === "number"
            ? Math.abs(item[key] - source[i][key]) > 0.1
            : item[key] !== source[i][key],
        )
        .map((key) => ({
          i,
          tag: item.tag,
          text: item.text.slice(0, 25),
          key,
          source: source[i][key],
          target: item[key],
        })),
    );
    console.log(JSON.stringify({ width, diffs }));
    expect(diffs).toEqual([]);
    await context.close();
  });
}
