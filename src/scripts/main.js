import { initPreferenceSync } from "./preferences.js";
import { initPreferenceControls } from "./preference-controls.js";
import { initPageAnchors } from "./page-anchors.js";
import { initFixedNav } from "./fixed-nav.js";
import { initLogoReveal } from "./logo-reveal.js";
import { initHeadingReveal } from "./heading-reveal.js";
import "./cards/text-cards.js";

initPreferenceSync();
initPreferenceControls();
initPageAnchors();
initFixedNav();
initLogoReveal();
initHeadingReveal();
