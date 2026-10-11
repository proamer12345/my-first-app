import { chromium } from "@playwright/test";
import { io } from "socket.io-client";
import assert from "node:assert/strict";
const sockets = [];
const states = [];
const request = (s, e, d = {}) =>
  new Promise((resolve, reject) =>
    s
      .timeout(4000)
      .emit(e, d, (err, r) =>
        err || !r.ok ? reject(err || Error(r.error)) : resolve(r),
      ),
  );
const connect = async () => {
  const s = io("http://127.0.0.1:3000", { transports: ["websocket"] });
  sockets.push(s);
  await new Promise((resolve) => s.once("connect", resolve));
  return s;
};
let browser;
try {
  const host = await connect();
  host.on("state", (v) => (states[0] = v));
  const seat = await request(host, "create", { name: "Narrator host" });
  for (let i = 1; i < 5; i++) {
    const s = await connect();
    s.on("state", (v) => (states[i] = v));
    await request(s, "join", { code: seat.code, name: "Narrator guest " + i });
  }
  const c = await connect();
  await assert.rejects(request(c, "start"), /Join/);
  await assert.rejects(request(sockets[1], "start"), /host/);
  host.disconnect();
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.addInitScript((seat) => {
    localStorage.setItem("council-session", JSON.stringify(seat));
    window.spokenReports = [];
    speechSynthesis.speak = (u) => window.spokenReports.push(u.text);
  }, seat);
  await page.goto("http://127.0.0.1:3000");
  await page.getByText("The table is waiting.").waitFor();
  await page.getByRole("button", { name: "Begin the night" }).click();
  await page.getByRole("checkbox", { name: "Voice narrator" }).check();
  await assert.rejects(
    request(c, "join", { code: seat.code, name: "Late player" }),
    /already started/,
  );
  await page.locator(".recap").waitFor({ timeout: 55000 });
  const reports = await page.evaluate(() => window.spokenReports);
  assert.equal(reports.length, 1);
  assert.match(reports[0], /No elimination/);
  await page.getByRole("button", { name: "Read the morning report" }).click();
  assert.equal(await page.evaluate(() => window.spokenReports.length), 2);
  console.log(
    "PASS: automatic and manual narration receive only public recap text; nonhost start and late joins rejected",
  );
} finally {
  for (const s of sockets) s.disconnect();
  await browser?.close();
}
