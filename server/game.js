import { randomBytes, randomInt } from "node:crypto";
export const durations = {
  night: 45000,
  morning: 14000,
  discussion: 60000,
  vote: 30000,
};
export const labels = {
  noir: {
    mafia: "Mafia",
    detective: "Detective",
    doctor: "Doctor",
    citizen: "Citizen",
  },
  space: {
    mafia: "Impostor",
    detective: "Scanner",
    doctor: "Medic",
    citizen: "Crew",
  },
  cyber: {
    mafia: "Syndicate",
    detective: "Analyst",
    doctor: "Medic",
    citizen: "Resident",
  },
};
export function player(name, avatar, color) {
  return {
    id: randomBytes(12).toString("hex"),
    token: randomBytes(24).toString("hex"),
    name,
    avatar,
    color,
    alive: true,
    connected: true,
    role: null,
    clue: null,
  };
}
export function room(code, p) {
  return {
    code,
    host: p.id,
    players: [p],
    theme: "noir",
    phase: "lobby",
    round: 0,
    deadline: null,
    actions: {},
    votes: {},
    chat: [],
    events: [],
    recap: null,
    winner: null,
  };
}
export function start(r) {
  if (r.players.length < 5) throw Error("At least 5 players are required.");
  if (r.players.some((p) => !p.connected))
    throw Error("Wait for all players to reconnect.");
  let roles = Array(r.players.length).fill("citizen");
  roles[0] = "detective";
  roles[1] = "doctor";
  for (
    let i = 0;
    i < (r.players.length < 7 ? 1 : r.players.length < 10 ? 2 : 3);
    i++
  )
    roles[2 + i] = "mafia";
  for (let i = roles.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  r.players.forEach((p, i) => {
    p.role = roles[i];
    p.alive = true;
    p.clue = null;
  });
  r.winner = null;
  r.round = 0;
  r.chat = [];
  r.events = [];
  r.recap = null;
  begin(r, "night");
}
export function begin(r, phase) {
  r.phase = phase;
  r.deadline = phase === "ended" ? null : Date.now() + durations[phase];
  if (phase === "night") {
    r.round++;
    r.actions = {};
    r.votes = {};
  }
  if (phase === "vote") r.votes = {};
}
export function checkWin(r) {
  const alive = r.players.filter((p) => p.alive),
    m = alive.filter((p) => p.role === "mafia").length;
  if (m === 0) r.winner = "citizens";
  else if (m >= alive.length - m) r.winner = "mafia";
  if (r.winner) begin(r, "ended");
  return !!r.winner;
}
function majority(values) {
  const counts = {};
  values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  const ordered = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return ordered.length && (!ordered[1] || ordered[0][1] > ordered[1][1])
    ? ordered[0][0]
    : null;
}
export function advance(r) {
  if (r.phase === "night") {
    const alive = r.players.filter((p) => p.alive);
    const victimId = majority(
      alive
        .filter((p) => p.role === "mafia")
        .map((p) => r.actions[p.id])
        .filter(Boolean),
    );
    const protectedId = alive.find((p) => p.role === "doctor");
    const victim = alive.find((p) => p.id === victimId);
    const died = victim && r.actions[protectedId?.id] !== victimId;
    if (died) victim.alive = false;
    const detective = alive.find((p) => p.role === "detective");
    const target = r.players.find((p) => p.id === r.actions[detective?.id]);
    if (detective && target)
      detective.clue = {
        round: r.round,
        name: target.name,
        mafia: target.role === "mafia",
      };
    r.recap = {
      round: r.round,
      incident: !!died,
      text: died
        ? "As dawn breaks, an empty seat tells the story. One resident did not survive the night. The council must uncover the truth."
        : "Dawn arrives and every seat is filled. No elimination was reported tonight. The danger remains hidden.",
      victim: died ? victim.name : null,
    };
    r.events.push({
      round: r.round,
      text: died
        ? `${victim.name} was eliminated overnight.`
        : "Nobody was eliminated overnight.",
    });
    begin(r, "morning");
  } else if (r.phase === "morning") {
    if (!checkWin(r)) begin(r, "discussion");
  } else if (r.phase === "discussion") begin(r, "vote");
  else if (r.phase === "vote") {
    const id = majority(Object.values(r.votes));
    const p = r.players.find((p) => p.id === id && p.alive);
    if (p) {
      p.alive = false;
      r.events.push({
        round: r.round,
        text: `${p.name} was voted out. Role: ${labels[r.theme][p.role]}.`,
      });
    } else
      r.events.push({
        round: r.round,
        text: "The vote ended without an elimination.",
      });
    if (!checkWin(r)) begin(r, "night");
  }
}
export function act(r, p, target) {
  if (!p.alive || !p.connected) throw Error("You cannot act right now.");
  if (r.phase === "vote") {
    if (
      target !== "skip" &&
      !r.players.some((x) => x.id === target && x.alive && x.id !== p.id)
    )
      throw Error("Choose another living player.");
    r.votes[p.id] = target;
    return;
  }
  if (r.phase !== "night" || p.role === "citizen")
    throw Error("No night action is available.");
  const t = r.players.find((x) => x.id === target && x.alive);
  if (
    !t ||
    (p.role !== "doctor" && t.id === p.id) ||
    (p.role === "mafia" && t.role === "mafia")
  )
    throw Error("Invalid target.");
  r.actions[p.id] = target;
}
export function view(r, p) {
  return {
    serverNow: Date.now(),
    code: r.code,
    host: r.host,
    theme: r.theme,
    phase: r.phase,
    round: r.round,
    deadline: r.deadline,
    winner: r.winner,
    recap: r.recap,
    events: r.events.slice(-12),
    chat: r.chat.slice(-80),
    me: {
      id: p.id,
      role: p.role,
      alive: p.alive,
      clue: p.clue,
      action: r.actions[p.id] || null,
      vote: r.votes[p.id] || null,
    },
    players: r.players.map((x) => ({
      id: x.id,
      name: x.name,
      avatar: x.avatar,
      color: x.color,
      alive: x.alive,
      connected: x.connected,
      role:
        r.phase === "ended" || !x.alive
          ? x.role
          : p.role === "mafia" && x.role === "mafia"
            ? x.role
            : null,
      voted: !!r.votes[x.id],
    })),
  };
}
