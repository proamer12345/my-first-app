import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { randomInt } from "node:crypto";
import { room, player, start, act, advance, view } from "./game.js";
const app = express(),
  http = createServer(app),
  io = new Server(http, { maxHttpBufferSize: 16000 });
const rooms = new Map(),
  sessions = new Map();
const broadcast = (r) =>
  r.players.forEach((p) => {
    const sid = sessions.get(p.token);
    if (sid) io.to(sid).emit("state", view(r, p));
  });
const get = (s) => {
  const r = rooms.get(s.data.code),
    p = r?.players.find((p) => p.id === s.data.pid);
  if (!r || !p) throw Error("Join a room first.");
  return [r, p];
};
const clean = (v, n) =>
  String(v || "")
    .trim()
    .slice(0, n);
function attach(s, r, p) {
  const old = sessions.get(p.token);
  if (old && old !== s.id) {
    const previous = io.sockets.sockets.get(old);
    if (previous) {
      previous.data = {};
      previous.disconnect(true);
    }
  }
  s.data.code = r.code;
  s.data.pid = p.id;
  sessions.set(p.token, s.id);
  p.connected = true;
  r.touched = Date.now();
  return { code: r.code, token: p.token };
}
io.on("connection", (s) => {
  let count = 0,
    last = Date.now();
  const on = (event, fn) =>
    s.on(event, (data = {}, reply) => {
      const ack = typeof reply === "function" ? reply : () => {};
      try {
        if (Date.now() - last > 10000) {
          count = 0;
          last = Date.now();
        }
        if (++count > 35) throw Error("Please slow down.");
        const result = fn(data);
        ack({ ok: true, ...result });
      } catch (e) {
        ack({ ok: false, error: e.message });
      }
    });
  on("create", (d) => {
    if (s.data.pid) throw Error("You already joined a room.");
    const name = clean(d.name, 24);
    if (!name) throw Error("Choose a display name.");
    let code;
    do {
      code = Array.from(
        { length: 6 },
        () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)],
      ).join("");
    } while (rooms.has(code));
    const p = player(
      name,
      Math.max(0, Math.min(7, Math.floor(Number(d.avatar)) || 0)),
      /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : "#e9b866",
    );
    const r = room(code, p);
    rooms.set(code, r);
    const result = attach(s, r, p);
    broadcast(r);
    return result;
  });
  on("join", (d) => {
    if (s.data.pid) throw Error("You already joined a room.");
    const r = rooms.get(clean(d.code, 6).toUpperCase());
    if (!r) throw Error("Room not found. Check the code.");
    if (r.phase !== "lobby") throw Error("This match has already started.");
    if (r.players.length >= 12) throw Error("Room is full.");
    const name = clean(d.name, 24);
    if (!name) throw Error("Choose a display name.");
    if (r.players.some((p) => p.name.toLowerCase() === name.toLowerCase()))
      throw Error("That name is already in use.");
    const p = player(
      name,
      Math.max(0, Math.min(7, Math.floor(Number(d.avatar)) || 0)),
      /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : "#e9b866",
    );
    r.players.push(p);
    const result = attach(s, r, p);
    broadcast(r);
    return result;
  });
  on("resume", (d) => {
    if (s.data.pid && s.data.code !== clean(d.code, 6))
      throw Error("Leave your current room first.");
    const r = rooms.get(clean(d.code, 6)),
      p = r?.players.find((p) => p.token === d.token);
    if (!p) throw Error("Your saved room is no longer available.");
    const result = attach(s, r, p);
    broadcast(r);
    return result;
  });
  on("theme", (d) => {
    const [r, p] = get(s);
    if (r.host !== p.id || r.phase !== "lobby")
      throw Error("Only the host can change the lobby theme.");
    if (!["noir", "space", "cyber"].includes(d.theme))
      throw Error("Unknown theme.");
    r.theme = d.theme;
    broadcast(r);
  });
  on("start", () => {
    const [r, p] = get(s);
    if (r.host !== p.id || r.phase !== "lobby")
      throw Error("Only the host can start from the lobby.");
    start(r);
    broadcast(r);
  });
  on("action", (d) => {
    const [r, p] = get(s);
    act(r, p, d.target);
    broadcast(r);
  });
  on("chat", (d) => {
    const [r, p] = get(s);
    if (!p.alive || !["lobby", "discussion", "vote"].includes(r.phase))
      throw Error("Chat is unavailable during this phase.");
    const text = clean(d.text, 300);
    if (text) {
      r.chat.push({ id: Date.now() + Math.random(), name: p.name, text });
      r.chat = r.chat.slice(-80);
    }
    broadcast(r);
  });
  on("rematch", () => {
    const [r, p] = get(s);
    if (r.host !== p.id || r.phase !== "ended")
      throw Error("Only the host can open a new lobby after the match.");
    r.players = r.players.filter((x) => x.connected);
    r.players.forEach((x) => {
      x.role = null;
      x.alive = true;
      x.clue = null;
    });
    Object.assign(r, {
      phase: "lobby",
      deadline: null,
      actions: {},
      votes: {},
      winner: null,
      recap: null,
      chat: [],
      events: [],
    });
    broadcast(r);
  });
  on("leave", () => {
    const [r, p] = get(s);
    if (r.phase !== "lobby")
      throw Error("Your seat remains reserved until the match ends.");
    sessions.delete(p.token);
    r.players = r.players.filter((x) => x !== p);
    s.data = {};
    if (!r.players.length) rooms.delete(r.code);
    else {
      if (r.host === p.id)
        r.host = r.players.find((x) => x.connected)?.id || r.players[0].id;
      broadcast(r);
    }
  });
  on("remove", (d) => {
    const [r, p] = get(s);
    if (r.host !== p.id || r.phase !== "lobby" || d.id === p.id)
      throw Error("Only the host can remove other lobby players.");
    const target = r.players.find((x) => x.id === d.id);
    if (target) {
      const sid = sessions.get(target.token);
      const other = io.sockets.sockets.get(sid);
      if (other) {
        other.emit("removed");
        other.data = {};
      }
      sessions.delete(target.token);
      r.players = r.players.filter((x) => x !== target);
    }
    broadcast(r);
  });
  s.on("disconnect", () => {
    try {
      const [r, p] = get(s);
      if (sessions.get(p.token) !== s.id) return;
      sessions.delete(p.token);
      p.connected = false;
      r.touched = Date.now();
      broadcast(r);
      setTimeout(() => {
        if (!p.connected && r.host === p.id) {
          const next = r.players.find((x) => x.connected);
          if (next) {
            r.host = next.id;
            broadcast(r);
          }
        }
      }, 30000);
    } catch {}
  });
});
setInterval(() => {
  for (const r of rooms.values()) {
    if (r.deadline && Date.now() >= r.deadline) {
      advance(r);
      broadcast(r);
    }
    if (!r.players.some((p) => p.connected) && Date.now() - r.touched > 3600000)
      rooms.delete(r.code);
  }
}, 250);
app.get("/health", (_, res) => res.json({ ok: true }));
if (process.env.NODE_ENV === "production") {
  app.use(express.static("dist"));
  app.get("/{*path}", (_, res) =>
    res.sendFile(process.cwd() + "/dist/index.html"),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
http.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () =>
  console.log(
    "Midnight Council listening on port " + (process.env.PORT || 3000),
  ),
);
