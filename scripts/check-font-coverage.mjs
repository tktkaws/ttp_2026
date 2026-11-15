import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
async function sources(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path, extension)
      : entry.name.endsWith(extension) ? [await readFile(path, "utf8")] : [];
  }))).flat();
}
const content = (await Promise.all([
  sources(join(root, "src/pages"), ".astro"),
  sources(join(root, "src/scripts"), ".js"),
])).flat().join("");
const { faces } = JSON.parse(await readFile(join(root, "src/config/fonts.json"), "utf8"));
const required = new Set([...content].filter((char) => !/\s/u.test(char)));
for (const face of faces) {
  const file = await readFile(join(root, "public", face.url));
  if (createHash("sha256").update(file).digest("hex") !== face.sha256) {
    throw new Error(`Font file changed: ${face.url}. Regenerate with scripts/subset-fonts.py.`);
  }
  if (face.family !== "Gen Interface JP") continue;
  const available = new Set(face.text);
  const missing = [...required].filter((char) => !available.has(char));
  if (missing.length) {
    throw new Error(`Font subset is missing ${JSON.stringify(missing.join(""))}. See docs/fonts.md to regenerate.`);
  }
}
// Logo text is deliberately limited; catch additions to either logo as well.
const html = await readFile(join(root, "src/pages/index.astro"), "utf8");
const logoText = [...html.matchAll(/<(?:h1|p)\b[^>]*class="[^"]*\bfont-zen\b[^"]*"[^>]*>([\s\S]*?)<\/(?:h1|p)>/g)]
  .map((match) => match[1].replace(/<!--[\s\S]*?-->|<[^>]*>/g, "")).join("");
const logo = new Set(faces.find((face) => face.family === "Zen Kaku Gothic New").text);
const missingLogo = [...new Set(logoText)].filter((char) => !/\s/u.test(char) && !logo.has(char));
if (missingLogo.length) throw new Error(`Logo subset is missing ${missingLogo.join("")}. See docs/fonts.md.`);
console.log(`Font coverage verified (${faces.length} local files).`);
