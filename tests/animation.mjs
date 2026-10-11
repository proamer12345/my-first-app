import { chromium } from "@playwright/test";
import { io } from "socket.io-client";
import assert from "node:assert/strict";
const clients = [],
  seats = [],
  states = [];
const request = (s, event, data = {}) =>
  new Promise((resolve, reject) =>
    s
      .timeout(4000)
      .emit(event, data, (err, r) =>
        err || !r.ok ? reject(err || Error(r.error)) : resolve(r),
      ),
  );
let browser;
try {
  for (let i = 0; i < 5; i++) {
    const s = io("http://127.0.0.1:3000");
    clients.push(s);
    s.on("state", (r) => (states[i] = r));
    await new Promise((resolve) => s.once("connect", resolve));
    seats.push(
      await request(s, i ? "join" : "create", {
        name: "Motion " + i,
        code: seats[0]?.code,
      }),
    );
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  clients[0].disconnect();
  await page.addInitScript(
    (seat) => localStorage.setItem("council-session", JSON.stringify(seat)),
    seats[0],
  );
  await page.goto("http://127.0.0.1:3000");
  await page.getByText("The table is waiting.").waitFor();
  for (const [title, animation] of [
    ["Classic Noir", "rain"],
    ["Deep Space", "stardrift"],
    ["Cyberpunk", "signalpulse"],
  ]) {
    await page.getByRole("button", { name: new RegExp(title) }).click();
    await page.waitForFunction(
      (name) =>
        getComputedStyle(document.querySelector(".particle")).animationName ===
        name,
      animation,
    );
    assert.equal(
      await page
        .locator(".atmosphere")
        .evaluate((e) => getComputedStyle(e).pointerEvents),
      "none",
    );
  }
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  console.log(
    "PASS: all three theme atmospheres animate without blocking controls or overflowing mobile",
  );
  await page.getByRole("button", { name: "Begin the night" }).click();
  await page.getByRole("button", { name: "Reveal my role" }).click();
  assert.equal(
    await page.locator(".dossier-toggle").getAttribute("aria-expanded"),
    "true",
  );
  await page.waitForTimeout(800);
  assert.notEqual(
    await page
      .locator(".dossier-flipper")
      .evaluate((e) => getComputedStyle(e).transform),
    "none",
  );
  await page.getByRole("button", { name: "Hide role" }).click();
  assert.equal(
    await page.locator(".role-panel h2").innerText(),
    "A secret identity",
  );
  console.log("PASS: role card flips and can be sealed again");
  const special = states.findIndex(
    (r, i) => i !== 0 && r.me.role !== "citizen",
  );
  const reducedContext = await browser.newContext({ reducedMotion: "reduce" });
  const reduced = await reducedContext.newPage();
  clients[special].disconnect();
  await reduced.addInitScript(
    (seat) => localStorage.setItem("council-session", JSON.stringify(seat)),
    seats[special],
  );
  await reduced.goto("http://127.0.0.1:3000");
  await reduced.locator(".targets button").first().click();
  assert.equal(await reduced.locator(".targets .selected").count(), 1);
  assert.equal(
    await reduced
      .locator(".particle")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
    "none",
  );
  await reduced.getByRole("button", { name: "Reveal my role" }).click();
  assert.equal(await reduced.locator(".dossier-inside").isVisible(), true);
  assert.equal(await reduced.locator(".phase-curtain").isVisible(), false);
  console.log(
    "PASS: action selection feedback and reduced-motion static role reveal",
  );
  await page.locator(".recap").waitFor({ timeout: 55000 });
  await reduced.locator(".recap").waitFor({ timeout: 10000 });
  await reduced.waitForFunction(() =>
    document.querySelector(".typing-cursor")?.classList.contains("finished"),
  );
  assert.equal(
    await reduced
      .locator(".typewriter [aria-hidden]")
      .innerText()
      .then((t) => t.replace("▍", "")),
    await reduced.locator(".typewriter .sr-only").innerText(),
  );
  assert.equal(
    await page
      .locator(".recap .scene")
      .evaluate((e) => getComputedStyle(e).animationName),
    "scene-develop",
  );
  await page.waitForTimeout(3000);
  await page.screenshot({
    path: "/tmp/midnight-animated-recap.png",
    fullPage: true,
  });
  console.log(
    "PASS: animated public recap and immediately readable reduced-motion report",
  );
  await page
    .getByRole("heading", { name: "Cast your vote" })
    .waitFor({ timeout: 85000 });
  const voter = clients.findIndex((s, i) => s.connected && states[i]?.me.alive);
  assert.ok(voter >= 0);
  const living = states[voter].players.filter((p) => p.alive);
  const target = living.find((p) => p.id !== states[voter].me.id);
  await request(clients[voter], "action", { target: target.id });
  await page.locator(".vote-stamp").first().waitFor();
  assert.match(await page.locator(".vote-count").innerText(), /ballots sealed/);
  assert.equal(
    await page
      .locator(".vote-stamp")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
    "stamp-in",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: synchronized animated ballot counter and roster stamps; no browser errors",
  );
} finally {
  clients.forEach((s) => s.disconnect());
  await browser?.close();
}
