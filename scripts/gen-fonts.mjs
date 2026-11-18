import { createHash, randomUUID } from "node:crypto";
import { glob, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceDirectory = join(root, "src");
const cacheDirectory = join(root, ".astro", "gen-fonts");
const extensions = "astro,css,html,js,json,jsx,md,mdx,mjs,ts,tsx,yaml,yml";
const sourceExtension = new RegExp(`\\.(?:${extensions.replaceAll(",", "|")})$`);
const moduleName = "virtual:gen-fonts";
const moduleId = `\0${moduleName}`;
const fonts = [
  { weight: 300, name: "Light", preload: true },
  { weight: 400, name: "Regular", preload: true },
  { weight: 500, name: "Medium", preload: false },
  { weight: 700, name: "Bold", preload: false },
];

async function collectCharacters() {
  const characters = new Set(Array.from({ length: 95 }, (_, index) =>
    String.fromCharCode(index + 32),
  ));
  for await (const file of glob(`**/*.{${extensions}}`, { cwd: sourceDirectory })) {
    const source = await readFile(join(sourceDirectory, file), "utf8");
    for (const character of source) {
      if (!/[\t\n\r\f\uFEFF]/u.test(character)) characters.add(character);
    }
  }
  return [...characters].sort().join("");
}

async function generateFont(source, weight, characters) {
  const subset = await subsetFont(source, characters, {
    targetFormat: "woff2",
    preserveNameIds: [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17],
    // Keep standard shaping, kerning, and fractions in the served subsets.
    keepFeatures: [
      "calt", "ccmp", "clig", "curs", "dnom", "frac", "kern", "liga",
      "locl", "mark", "mkmk", "numr", "rclt", "rlig", "rvrn",
    ],
  });
  const hash = createHash("sha256").update(subset).digest("hex").slice(0, 12);
  const filename = `gen-${weight}-${hash}.woff2`;
  const temporary = join(cacheDirectory, `${filename}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, subset);
    await rename(temporary, join(cacheDirectory, filename));
  } finally {
    await rm(temporary, { force: true });
  }
  return `/.astro/gen-fonts/${filename}?url`;
}

export default function genFonts() {
  let cached;

  return {
    name: "portfolio-gen-fonts",
    resolveId(id) {
      if (id === moduleName) return moduleId;
    },
    async load(id) {
      if (id !== moduleId) return;

      const characters = await collectCharacters();
      if (cached?.characters !== characters) {
        const files = mkdir(cacheDirectory, { recursive: true }).then(() =>
          Promise.all(fonts.map(async ({ weight, name }) => {
            const source = await readFile(join(root, "assets", "fonts", `GenInterfaceJP-${name}.woff2`));
            return generateFont(source, weight, characters);
          })),
        );
        cached = { characters, files };
        files.catch(() => {
          if (cached?.files === files) cached = undefined;
        });
      }

      const files = await cached.files;
      const imports = files.map((file, index) => `import font${index} from ${JSON.stringify(file)};`);
      const faces = fonts.map(({ weight, preload }, index) =>
        `{ family: "Gen Interface JP", weight: ${weight}, url: font${index}, preload: ${preload} }`,
      );
      return `${imports.join("\n")}\nexport const genFaces = [${faces.join(", ")}];`;
    },
    hotUpdate({ file, modules }) {
      if (!sourceExtension.test(file) || relative(sourceDirectory, file).startsWith("..")) return;

      // Content files are read on disk and need an explicit dependency for HMR.
      const fontModule = this.environment.moduleGraph.getModuleById(moduleId);
      if (fontModule) return [...new Set([...modules, fontModule])];
    },
  };
}
