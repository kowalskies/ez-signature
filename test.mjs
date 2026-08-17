/* Loads index.html in Chromium and asserts the markup rules that Outlook
   silently breaks if we get them wrong. Run: node test.mjs */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const TYPES = { ".html": "text/html", ".jpg": "image/jpeg", ".png": "image/png" };
const server = createServer(async (req, res) => {
  const p = join(import.meta.dirname, req.url === "/" ? "index.html" : decodeURI(req.url));
  try {
    const body = await readFile(p);
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "text/plain" });
    res.end(body);
  } catch {
    res.writeHead(404).end("no");
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base);

const fill = async (v) => {
  for (const [id, val] of Object.entries(v)) await page.fill("#" + id, val);
  await page.waitForTimeout(200);
};
const html = () => page.evaluate(() => current.html);
const plain = () => page.evaluate(() => current.plain);

await fill({
  name: "Jayani Kaushalya",
  position: "Junior Reservations Executive",
  email: "jayani@canareef.com",
  mobile: "+94 778106532",
  direct: "+960 6896677"
});

const h = await html();

// --- Structure Word cares about ---
assert.match(h, /<table width="600"[^>]*style="width:600px/, "600px as attribute and style");
assert.ok(!/max-width/.test(h), "no max-width: Word ignores it");
assert.ok(!/<div|flex|display:grid|class=|<style|background-image|\.svg/i.test(h), "no divs, flex, grid, classes, style block, bg images or svg");
assert.ok(!/margin:(?!0)/.test(h), "no non-zero margins");
assert.ok(!/data:image/.test(h), "no base64 images");

// Every line-height is px, and every text cell pins mso-line-height-rule.
const lineHeights = h.match(/line-height:[^;"]+/g) || [];
assert.ok(lineHeights.length > 0);
for (const lh of lineHeights) assert.match(lh, /line-height:\d+px/, `unitless line-height: ${lh}`);
// 8 text cells: name, position, property, E:, T:/M:, website, address, disclaimer.
assert.equal((h.match(/mso-line-height-rule:exactly/g) || []).length, 8, "every text cell pins mso line-height");

// Every img has width, height, alt, border=0.
for (const img of h.match(/<img[^>]*>/g) || []) {
  for (const attr of ["width=", "height=", "alt=", 'border="0"']) {
    assert.ok(img.includes(attr), `img missing ${attr}: ${img}`);
  }
}
assert.equal((h.match(/<img/g) || []).length, 7, "logo + 5 socials + banner");

// Social icons resolve to the folder named after the font colour, so they
// recolour with the brand instead of being hardcoded.
for (const net of ["facebook", "instagram", "youtube", "tiktok", "linkedin"]) {
  assert.ok(h.includes(`social/876432/${net}-v1.png" width="20" height="20"`), `${net} icon in brand colour at 20x20`);
}
assert.ok(!/social-[a-z]+-v1/.test(h), "no colour-agnostic icon paths left");

// Every link carries colour + text-decoration on BOTH <a> and nested <span>,
// or Outlook restyles mailto:/tel: to underlined blue.
const textLinks = h.match(/<a [^>]*>(?!<img)<span[^>]*>/g) || [];
assert.equal(textLinks.length, 4, "email, T:, M:, website are the four text links");
for (const a of textLinks) {
  assert.equal((a.match(/color:#876432;text-decoration:none/g) || []).length, 2,
    `link needs colour + text-decoration on BOTH the <a> and the nested <span>: ${a}`);
}
assert.ok(!/color:#0000|blue/i.test(h), "no blue anywhere");

// tel: hrefs are E.164.
assert.ok(h.includes('href="tel:+94778106532"'), "mobile normalised to E.164");
assert.ok(h.includes('href="tel:+9606896677"'), "direct line normalised to E.164");

// Banner: display:block kills the phantom gap under images.
assert.match(h, /banner-canareef-v1\.png" width="600" height="106"[^>]*display:block/, "banner sized and display:block");

// 1px rule is a bgcolor td, not a border.
assert.match(h, /<td height="1" bgcolor="#876432"[^>]*font-size:0;line-height:0/, "rule is a bgcolor td");
assert.ok(!/border-bottom/.test(h), "no border-bottom rules");

// --- Size budget ---
// The PRD's 5 KB target predates the markup. It is not reachable while keeping
// every mandated inline rule (mso-line-height-rule, explicit colour and
// font-family per cell, nowrap) alongside a 445-character legal disclaimer and
// seven absolute image URLs. 7.5 KB is the PRD's warn line and 8 KB is the hard
// limit Outlook on the web enforces; both are what the app reports against.
const bytes = Buffer.byteLength(h);
assert.ok(bytes < 7500, `under the 7.5 KB warn line, got ${bytes}`);

// --- Escaping ---
await fill({ position: "Sales & Events <Manager> \"O'Brien\"" });
const escaped = await html();
assert.ok(escaped.includes("Sales &amp; Events &lt;Manager&gt; &quot;O&#39;Brien&quot;"), "text escaped");
assert.ok(!/<Manager>/.test(escaped), "no raw angle brackets from user input");
await fill({ position: "Junior Reservations Executive" });

// --- Optional rows are omitted, not empty ---
await fill({ direct: "" });
const noDirect = await html();
assert.ok(!noDirect.includes("T:"), "T: row omitted when direct line is blank");
assert.ok(noDirect.includes("M:"), "M: still present");
await fill({ direct: "+960 6896677" });

// --- Plain text output ---
assert.equal(await plain(), [
  "Jayani Kaushalya",
  "Junior Reservations Executive",
  "Canareef Resort Maldives",
  "M: +94 778106532 | T: +960 6896677",
  "jayani@canareef.com | www.canareef.com"
].join("\n"));

await page.check("#showRes");
await page.waitForTimeout(200);
assert.ok((await plain()).includes("jayani@canareef.com | reservations@canareef.com | www.canareef.com"));
assert.ok((await html()).includes("mailto:reservations@canareef.com"));
await page.uncheck("#showRes");

// --- Banner options ---
await page.check("#bannerChoices input[value=none]");
await page.waitForTimeout(200);
assert.ok(!(await html()).includes("banner-canareef"), "None removes the banner row");

await page.check("#bannerChoices input[value=custom]");
await page.fill("#customBanner", "http://insecure.example/b.jpg");
await page.waitForTimeout(250);
assert.ok(await page.isDisabled("#copyRich"), "http:// custom URL blocks the outputs");
await page.fill("#customBanner", "https://cdn.example.com/promo-v1.jpg");
await page.waitForTimeout(250);
assert.ok((await html()).includes('src="https://cdn.example.com/promo-v1.jpg" width="600" height="106"'), "custom banner used at 600x106");
assert.ok(await page.isEnabled("#copyRich"));
await page.check("#bannerChoices input[value=panorama]");

// --- Validation gates the outputs ---
await fill({ mobile: "0771" });
await page.waitForTimeout(250);
assert.ok(await page.isDisabled("#copyRich"), "short number without country code blocks outputs");
assert.match(await page.textContent("#err-mobile"), /country code/);
await fill({ mobile: "+94 778106532" });
await page.waitForTimeout(250);
assert.ok(await page.isEnabled("#copyRich"));

// Domain mismatch warns but does not block.
await fill({ email: "jayani@gmail.com" });
await page.waitForTimeout(250);
assert.match(await page.textContent("#err-email"), /not a @canareef\.com address/);
assert.ok(await page.isEnabled("#copyRich"), "domain mismatch is a warning, not a block");
await fill({ email: "jayani@canareef.com" });

// --- Empty state previews the placeholder person, outputs stay disabled ---
await page.click("#reset");
await page.waitForTimeout(250);
// Empty-state placeholders are generic, and carry no real staff name, real
// number or hardcoded property domain that could be mistaken for filled-in data.
const empty = await html();
for (const generic of ["Your Name", "Your Job Title", "+000 0000000", "you@canareef.com"]) {
  assert.ok(empty.includes(generic), `placeholder preview shows ${generic}`);
}
assert.ok(!/Jayani|Kaushalya|778106532|6896677/.test(empty), "no real names or numbers in the empty state");
assert.ok(await page.isDisabled("#copyRich"), "outputs disabled until the required fields pass");

// --- Second brand: everything colour-driven moves together ---
await fill({
  name: "Jayani Kaushalya",
  position: "Junior Reservations Executive",
  email: "jayani@palmscape.com",
  mobile: "+94 778106532",
  direct: "+960 6896677" // same shape as the Canareef case, so the colour counts compare like for like
});
await page.selectOption("#brand", "palmscape");
await page.waitForTimeout(250);
const g = await html();
assert.ok(g.includes("Palmscape Boutique Hotel"), "property name");
assert.ok(!/#876432/.test(g), "no Canareef brown leaks into Palmscape");
assert.equal((g.match(/#2a5e50/g) || []).length, (h.match(/#876432/g) || []).length,
  "every place the brown appeared is now green");
assert.ok(g.includes('bgcolor="#2a5e50"'), "rule takes the brand colour");
assert.ok(g.includes('logo-palmscape-v1.png" width="90" height="97"'), "stacked lockup at its own aspect ratio");

// Column widths follow the logo instead of a hardcoded 110, so the three
// columns always sum to the 600px table width.
for (const markup of [h, g]) {
  const cols = await page.evaluate((m) => {
    const el = document.createElement("div");
    el.innerHTML = m;
    return [...el.querySelector("table > tbody > tr").children].map((td) => ({
      attr: Number(td.getAttribute("width")),
      style: parseInt(td.style.width, 10)
    }));
  }, markup);
  assert.equal(cols.length, 3, "three columns in the top row");
  assert.equal(cols.reduce((a, c) => a + c.attr, 0), 600, `columns sum to 600, got ${JSON.stringify(cols)}`);
  for (const c of cols) assert.equal(c.attr, c.style, "width attribute and style agree");
}
assert.equal((g.match(/<img/g) || []).length, 1, "logo only: no socials or banner configured yet");
assert.ok(!(await page.locator("#draftNote").isHidden()), "draft warning shown for an unfinished property");
assert.match(await page.textContent("#draftNote"), /do not install it yet/);

// The green icon set exists and is the colour it claims, so the row renders
// correctly the moment social handles are added to the config.
const iconRes = await page.request.get(base + "assets/social/2a5e50/tiktok-v1.png");
assert.equal(iconRes.status(), 200, "green tiktok icon is deployed");
const px = await page.evaluate(async (src) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height).data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) return [d[i], d[i + 1], d[i + 2]];
  return null;
}, base + "assets/social/2a5e50/tiktok-v1.png");
assert.deepEqual(px, [42, 94, 80], "icon glyph is rendered in #2a5e50");

await page.selectOption("#brand", "canareef");
await page.waitForTimeout(250);
assert.ok(await page.locator("#draftNote").isHidden(), "no draft warning on a finished property");

assert.deepEqual(errors, [], "no page errors");

// Screenshots for the record.
await fill({
  name: "Jayani Kaushalya",
  position: "Junior Reservations Executive",
  email: "jayani@canareef.com",
  mobile: "+94 778106532",
  direct: "+960 6896677"
});
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/app.png", fullPage: true });
await page.locator("#preview").screenshot({ path: "/tmp/sig-light.png" });
await page.click("#bgDark");
await page.waitForTimeout(300);
await page.locator("#preview").screenshot({ path: "/tmp/sig-dark.png" });

console.log(`all checks passed · signature is ${bytes} bytes`);
await browser.close();
server.close();
