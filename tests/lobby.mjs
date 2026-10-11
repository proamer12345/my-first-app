import { io } from "socket.io-client";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const clients = [],
  snapshots = [];
const request = (s, e, d = {}) =>
  new Promise((resolve, reject) =>
    s
      .timeout(4000)
      .emit(e, d, (err, r) =>
        err || !r.ok ? reject(err || Error(r.error)) : resolve(r),
      ),
  );
const connect = async () => {
  const s = io("http://127.0.0.1:3000");
  clients.push(s);
  await new Promise((resolve) => s.once("connect", resolve));
  return s;
};
let browser;
try {
  let seats = [];
  for (let i = 0; i < 5; i++) {
    const s = await connect();
    s.on("state", (r) => (snapshots[i] = r));
    seats.push(
      await request(s, i ? "join" : "create", {
        name: "Clock " + i,
        code: seats[0]?.code,
      }),
    );
  }
  clients[4].emit("theme", {}, 123);
  await request(clients[4], "leave");
  await request(clients[4], "join", { name: "Clock 4", code: seats[0].code });
  console.log(
    "PASS: lobby leave removes seat and permits rejoin; malformed acknowledgement does not crash server",
  );
  clients[0].disconnect();
  await new Promise((resolve) => setTimeout(resolve, 31000));
  assert.equal(snapshots[1].host, snapshots[1].me.id);
  console.log("PASS: disconnected host transfers control after grace period");
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const pages = [];
  for (let i = 1; i < 3; i++) {
    clients[i].disconnect();
    const context = await browser.newContext();
    const p = await context.newPage();
    await p.addInitScript(
      ({ seat, skew }) => {
        localStorage.setItem("council-session", JSON.stringify(seat));
        if (skew) {
          const original = Date.now;
          Date.now = () => original() + 3600000;
        }
      },
      { seat: seats[i], skew: i === 2 },
    );
    await p.goto("http://127.0.0.1:3000");
    await p.getByText("The table is waiting.").waitFor();
    pages.push(p);
  }
  await assert.rejects(
    request(clients[3], "remove", { id: snapshots[3].players[0].id }),
    /host/,
  );
  // Reconnect the original seat before starting; disconnected seats are deliberately reserved.
  const restored = await connect();
  await request(restored, "resume", seats[0]);
  await pages[0].getByRole("button", { name: "Begin the night" }).click();
  await pages[1].locator(".phase-bar strong").waitFor();
  const clocks = await Promise.all(
    pages.map((p) => p.locator(".phase-bar strong").innerText()),
  );
  assert.ok(Math.abs(parseInt(clocks[0]) - parseInt(clocks[1])) <= 1);
  console.log(
    "PASS: devices with clocks an hour apart show synchronized phase countdowns",
  );
} finally {
  clients.forEach((s) => s.disconnect());
  await browser?.close();
}
