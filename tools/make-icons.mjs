/* Social icon library.

   Outlook cannot recolour an icon: no SVG, no CSS masks, no filters, no web
   fonts. So "icons follow the font colour" means pre-rendering the set once per
   colour and letting the brand config point at the matching folder.

   Glyphs come from simple-icons (CC0). Rasterising uses the Chromium that
   Playwright already ships, so there is no image library to install.

   Usage:  node tools/make-icons.mjs [hex ...]     e.g. node tools/make-icons.mjs 876432 ffffff
   Output: assets/social/<hex>/<network>-v1.png    40x40, transparent, 1x display size is 20x20
*/
import { chromium } from "playwright";
import * as si from "simple-icons";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SIZE = 40; // 2x the 20px display size, for retina
const OUT = join(import.meta.dirname, "..", "assets", "social");

// The library. Add a network here and it exists for every colour.
const NETWORKS = {
  facebook: "siFacebook",
  instagram: "siInstagram",
  youtube: "siYoutube",
  linkedin: "linkedin",
  x: "siX",
  tiktok: "siTiktok",
  whatsapp: "siWhatsapp",
  pinterest: "siPinterest",
  tripadvisor: "siTripadvisor"
};

// simple-icons removed LinkedIn after a trademark request, so its glyph is
// inlined. Path from Font Awesome 6 Brands, CC BY 4.0 (fontawesome.com/license).
const INLINE = {
  linkedin: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"
};

const colours = (process.argv.slice(2).length ? process.argv.slice(2) : ["876432"])
  .map((c) => c.replace(/^#/, "").toLowerCase());

for (const c of colours) {
  if (!/^[0-9a-f]{6}$/.test(c)) throw new Error(`not a 6-digit hex colour: ${c}`);
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
let n = 0;

for (const colour of colours) {
  const dir = join(OUT, colour);
  await mkdir(dir, { recursive: true });

  for (const [network, key] of Object.entries(NETWORKS)) {
    const path = INLINE[key] || si[key]?.path;
    if (!path) throw new Error(`no glyph for ${network} (looked for ${key})`);

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${SIZE}" height="${SIZE}">` +
      `<path fill="#${colour}" d="${path}"/></svg>`;

    await page.setContent(
      `<body style="margin:0;width:${SIZE}px;height:${SIZE}px">${svg}</body>`
    );
    // omitBackground keeps the PNG transparent so one file works on light and
    // dark. The glyph carries the same colour as the surrounding text, so it
    // fades or holds exactly as the text does.
    await writeFile(join(dir, `${network}-v1.png`), await page.screenshot({ omitBackground: true }));
    n++;
  }
  console.log(`#${colour} → assets/social/${colour}/ (${Object.keys(NETWORKS).length} icons)`);
}

await browser.close();
console.log(`${n} PNGs written. Icon glyphs: simple-icons, CC0.`);
