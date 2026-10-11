import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const contexts = [],
  pages = [],
  errors = [];
try {
  for (let i = 0; i < 5; i++) {
    const context = await browser.newContext({
      viewport:
        i === 1 ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    });
    contexts.push(context);
    const p = await context.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    pages.push(p);
    await p.goto("http://127.0.0.1:3000");
    await p.getByPlaceholder("What should we call you?").fill("Guest " + i);
    if (i === 0) {
      await p.getByRole("button", { name: "Create room" }).click();
      await p.getByText("The table is waiting.").waitFor();
    } else {
      const code = await pages[0].locator(".room-code strong").innerText();
      await p.getByPlaceholder("ABCDEF").fill(code);
      await p.getByRole("button", { name: "Join room" }).click();
      await p.getByText("The table is waiting.").waitFor();
    }
  }
  console.log("PASS: five isolated browsers joined one room");
  await pages[0]
    .getByRole("button", { name: "Deep Space Far from home." })
    .click();
  await pages[1].locator(".app.space").waitFor();
  await pages[1].reload();
  await pages[1].getByText("The table is waiting.").waitFor();
  assert.equal(await pages[0].locator(".person").count(), 5);
  assert.equal(
    await pages[1].evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await pages[1].screenshot({
    path: "artifacts/mobile-lobby.png",
    fullPage: true,
  });
  await pages[0].screenshot({
    path: "artifacts/desktop-lobby.png",
    fullPage: true,
  });
  console.log(
    "PASS: theme synchronized, mobile fits screen, refreshed player reclaimed seat",
  );
  await pages[0].getByRole("button", { name: "Begin the night" }).click();
  const roles = [];
  for (const p of pages) {
    await p.getByRole("button", { name: "Reveal my role" }).click();
    roles.push(await p.locator(".role-panel h2").innerText());
  }
  const mafia = roles.indexOf("Impostor"),
    detective = roles.indexOf("Scanner"),
    doctor = roles.indexOf("Medic");
  const citizens = roles
    .map((r, i) => (r === "Crew" ? i : -1))
    .filter((i) => i >= 0);
  const victim = citizens[0];
  await pages[mafia]
    .locator(".targets button")
    .filter({ hasText: "Guest " + victim })
    .click();
  await pages[detective]
    .locator(".targets button")
    .filter({ hasText: "Guest " + mafia })
    .click();
  await pages[doctor]
    .locator(".targets button")
    .filter({ hasText: "Guest " + doctor })
    .click();
  console.log("PASS: special-role actions accepted through browser UI");
  await pages[0].locator(".recap").waitFor({ timeout: 55000 });
  assert.match(await pages[0].locator(".recap").innerText(), /An empty seat/);
  assert.match(
    await pages[detective].locator(".clue").innerText(),
    /Mafia allegiance detected/,
  );
  assert.equal(await pages[victim].locator(".clue").count(), 0);
  assert.equal(
    await pages[0]
      .locator(".scene")
      .innerText()
      .then((t) => t.includes("Guest")),
    false,
  );
  await pages[0].screenshot({
    path: "artifacts/morning-recap.png",
    fullPage: true,
  });
  console.log(
    "PASS: public morning report, anonymous scene, private investigation, elimination",
  );
  await pages[0]
    .getByRole("heading", { name: "Bring your suspicions to the table" })
    .waitFor({ timeout: 20000 });
  await pages[doctor]
    .getByRole("textbox", { name: "Chat message" })
    .fill("I have a suspicion.");
  await pages[doctor].getByRole("button", { name: "Send message" }).click();
  await pages[detective]
    .getByText("I have a suspicion.", { exact: true })
    .waitFor();
  assert.equal(
    await pages[victim]
      .getByRole("textbox", { name: "Chat message" })
      .isDisabled(),
    true,
  );
  console.log("PASS: live chat and spectator restrictions");
  await pages[0]
    .getByRole("heading", { name: "Cast your vote" })
    .waitFor({ timeout: 65000 });
  for (let i = 0; i < 5; i++)
    if (i !== mafia && i !== victim)
      await pages[i]
        .locator(".targets button")
        .filter({ hasText: "Guest " + mafia })
        .click();
  await pages[0].locator(".victory").waitFor({ timeout: 35000 });
  assert.match(await pages[0].locator(".victory").innerText(), /citizens win/);
  assert.equal(
    await pages[0]
      .locator(".person small")
      .filter({ hasText: /Impostor|Scanner|Medic|Crew/ })
      .count(),
    5,
  );
  await pages[0].getByRole("button", { name: "Return to lobby" }).click();
  await pages[4].getByText("The table is waiting.").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: citizen victory, revealed roles, synchronized rematch; no browser errors",
  );
} finally {
  await browser.close();
}
