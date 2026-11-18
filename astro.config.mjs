import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import genFonts from "./scripts/gen-fonts.mjs";

// https://astro.build/config
export default defineConfig({
  devToolbar: {
    enabled: false,
  },
  vite: {
    plugins: [tailwindcss(), genFonts()],
  },
});
