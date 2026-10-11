import test from "node:test";
import assert from "node:assert/strict";
import {
  room,
  player,
  start,
  act,
  advance,
  view,
  checkWin,
} from "../server/game.js";
function fixture() {
  const ps = Array.from({ length: 5 }, (_, i) =>
    player("Player " + i, i, "#e9b866"),
  );
  const r = room("ABCDEF", ps[0]);
  r.players = ps;
  start(r);
  return r;
}
test("minimum count and role distribution", () => {
  const r = room("A", player("a", 0, "#000000"));
  assert.throws(() => start(r), /5/);
  const full = fixture();
  assert.equal(full.players.filter((p) => p.role === "mafia").length, 1);
  assert.equal(full.players.filter((p) => p.role === "detective").length, 1);
  assert.equal(full.players.filter((p) => p.role === "doctor").length, 1);
});
test("private snapshots never expose tokens, hidden roles or other actions", () => {
  const r = fixture(),
    m = r.players.find((p) => p.role === "mafia"),
    d = r.players.find((p) => p.role === "detective"),
    c = r.players.find((p) => p.role === "citizen");
  act(r, m, c.id);
  act(r, d, m.id);
  const snapshot = view(r, c);
  assert.equal(snapshot.players.find((p) => p.id === m.id).role, null);
  assert.equal(snapshot.me.action, null);
  assert.equal(JSON.stringify(snapshot).includes(m.token), false);
  assert.equal("actions" in snapshot, false);
});
test("protection prevents kill and investigation is private", () => {
  const r = fixture(),
    m = r.players.find((p) => p.role === "mafia"),
    d = r.players.find((p) => p.role === "detective"),
    med = r.players.find((p) => p.role === "doctor"),
    c = r.players.find((p) => p.role === "citizen");
  act(r, m, c.id);
  act(r, med, c.id);
  act(r, d, m.id);
  advance(r);
  assert.equal(c.alive, true);
  assert.equal(r.recap.incident, false);
  assert.equal(d.clue.mafia, true);
  assert.equal(view(r, c).me.clue, null);
  assert.equal(r.recap.text.includes(m.name), false);
});
test("kill, vote, citizen victory and revealed final roles", () => {
  const r = fixture(),
    m = r.players.find((p) => p.role === "mafia"),
    c = r.players.find((p) => p.role === "citizen");
  act(r, m, c.id);
  advance(r);
  assert.equal(c.alive, false);
  assert.equal(r.phase, "morning");
  advance(r);
  assert.equal(r.phase, "discussion");
  advance(r);
  for (const p of r.players.filter((p) => p.alive && p.id !== m.id))
    act(r, p, m.id);
  advance(r);
  assert.equal(r.phase, "ended");
  assert.equal(r.winner, "citizens");
  assert.ok(view(r, c).players.every((p) => p.role));
});
test("ties and missing actions produce no elimination", () => {
  const r = fixture();
  advance(r);
  assert.equal(
    r.players.every((p) => p.alive),
    true,
  );
  advance(r);
  advance(r);
  act(r, r.players[0], r.players[1].id);
  act(r, r.players[1], r.players[0].id);
  advance(r);
  assert.equal(
    r.players.every((p) => p.alive),
    true,
  );
  assert.equal(r.phase, "night");
});
test("server rejects out-of-phase, teammate and dead actions", () => {
  const r = fixture(),
    m = r.players.find((p) => p.role === "mafia"),
    c = r.players.find((p) => p.role === "citizen");
  assert.throws(() => act(r, c, m.id));
  assert.throws(() => act(r, m, m.id));
  c.alive = false;
  assert.throws(() => act(r, c, m.id));
});
test("mafia win at parity", () => {
  const r = fixture();
  let c = 0;
  r.players.forEach((p) => {
    if (p.role !== "mafia") p.alive = c++ === 0;
  });
  assert.equal(checkWin(r), true);
  assert.equal(r.winner, "mafia");
});

test("large-room distribution and Mafia teammate privacy", () => {
  const r = room("LARGE", player("Host", 0, "#000000"));
  r.players = Array.from({ length: 12 }, (_, i) =>
    player("Guest " + i, i % 8, "#000000"),
  );
  start(r);
  assert.equal(r.players.filter((p) => p.role === "mafia").length, 3);
  assert.equal(r.players.filter((p) => p.role === "detective").length, 1);
  assert.equal(r.players.filter((p) => p.role === "doctor").length, 1);
  const mafia = r.players.find((p) => p.role === "mafia");
  const snapshot = view(r, mafia);
  assert.equal(snapshot.players.filter((p) => p.role === "mafia").length, 3);
  assert.equal(
    snapshot.players.some((p) => p.role === "doctor" || p.role === "detective"),
    false,
  );
});

test("multiple Mafia selections tie without an attack", () => {
  const r = room("TIED", player("Host", 0, "#000000"));
  r.players = Array.from({ length: 7 }, (_, i) =>
    player("Guest " + i, i, "#000000"),
  );
  start(r);
  const mafia = r.players.filter((p) => p.role === "mafia");
  const targets = r.players.filter((p) => p.role === "citizen");
  act(r, mafia[0], targets[0].id);
  assert.throws(() => act(r, mafia[0], mafia[1].id), /target/);
  act(r, mafia[1], targets[1].id);
  advance(r);
  assert.equal(r.recap.incident, false);
  assert.equal(
    r.players.every((p) => p.alive),
    true,
  );
});

test("a disconnected player cannot submit and a skip plurality spares everyone", () => {
  const r = fixture();
  const mafia = r.players.find((p) => p.role === "mafia");
  mafia.connected = false;
  assert.throws(
    () => act(r, mafia, r.players.find((p) => p.role === "citizen").id),
    /cannot act/,
  );
  mafia.connected = true;
  advance(r);
  advance(r);
  advance(r);
  act(r, r.players[0], "skip");
  act(r, r.players[1], "skip");
  act(r, r.players[2], r.players[3].id);
  advance(r);
  assert.equal(
    r.players.every((p) => p.alive),
    true,
  );
});
