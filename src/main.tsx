import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import "./style.css";
import type { GameView, Reply } from "./types";
const socket = io();
const portraits = ["🕵️", "👩🏽‍🚀", "🧑🏻‍✈️", "👩🏾‍🔬", "🧑🏼‍🎤", "👨🏿‍💼", "👩🏻‍🔧", "🧑🏽‍💻"];
const themes = {
  noir: {
    title: "Classic Noir",
    subtitle: "A city of secrets. A council of suspects.",
    roles: {
      mafia: "Mafia",
      detective: "Detective",
      doctor: "Doctor",
      citizen: "Citizen",
    },
  },
  space: {
    title: "Deep Space",
    subtitle: "Far from home. Closer to danger.",
    roles: {
      mafia: "Impostor",
      detective: "Scanner",
      doctor: "Medic",
      citizen: "Crew",
    },
  },
  cyber: {
    title: "Cyberpunk",
    subtitle: "Trust is the last unencrypted signal.",
    roles: {
      mafia: "Syndicate",
      detective: "Analyst",
      doctor: "Medic",
      citizen: "Resident",
    },
  },
};
const description = {
  mafia:
    "Choose a resident to eliminate. Your teammates are marked on the roster. The most selected target is attacked; tied selections cause no attack.",
  detective:
    "Investigate another resident. Your private result arrives at morning.",
  doctor:
    "Protect one resident from tonight’s attack. You may protect yourself.",
  citizen: "Observe, discuss, and vote. You have no night action.",
};
function App() {
  const [state, setState] = useState<GameView | null>(null),
    [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [avatar, setAvatar] = useState(0),
    [color, setColor] = useState("#e9b866"),
    [error, setError] = useState(""),
    [rules, setRules] = useState(false),
    [connected, setConnected] = useState(socket.connected),
    [text, setText] = useState(""),
    [now, setNow] = useState(Date.now()),
    [voice, setVoice] = useState(false),
    [revealed, setRevealed] = useState(false);
  const spoken = useRef("");
  const clockOffset = useRef(0);
  const send = (event: string, data: Record<string, unknown> = {}) =>
    socket.emit(event, data, (res: Reply) => {
      if (!res.ok) setError(res.error || "Something went wrong.");
      else {
        setError("");
        if (res.token)
          localStorage.setItem(
            "council-session",
            JSON.stringify({ code: res.code, token: res.token }),
          );
      }
    });
  useEffect(() => {
    const resume = () => {
      setConnected(true);
      let saved;
      try {
        saved = JSON.parse(localStorage.getItem("council-session") || "null");
      } catch {}
      if (saved)
        socket.emit("resume", saved, (res: Reply) => {
          if (!res.ok) {
            localStorage.removeItem("council-session");
            setState(null);
            setError(res.error || "Something went wrong.");
          }
        });
    };
    const removed = () => {
      localStorage.removeItem("council-session");
      setState(null);
      setError("The host removed your seat from the lobby.");
    };
    socket.on("connect", resume);

    const receive = (snapshot: GameView) => {
      clockOffset.current = snapshot.serverNow - Date.now();
      setNow(snapshot.serverNow);
      setState(snapshot);
    };
    const disconnect = () => setConnected(false);
    socket.on("state", receive);
    socket.on("removed", removed);
    socket.on("disconnect", disconnect);
    if (socket.connected) resume();
    const timer = setInterval(
      () => setNow(Date.now() + clockOffset.current),
      250,
    );
    return () => {
      clearInterval(timer);
      socket.off("connect", resume);
      socket.off("state", receive);
      socket.off("disconnect", disconnect);
      socket.off("removed", removed);
    };
  }, []);
  useEffect(() => {
    if (state?.phase === "night" && state.round === 1) setRevealed(false);
  }, [state?.phase, state?.round]);
  function speak() {
    if (!("speechSynthesis" in window)) {
      setError(
        "Your browser does not support voice narration. The written recap is available.",
      );
      return;
    }
    if (!state?.recap) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(state.recap.text);
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
  }
  useEffect(() => {
    if (state?.phase === "lobby") spoken.current = "";
    const key = state ? `${state.code}:${state.round}` : "";
    if (state?.phase === "morning" && voice && spoken.current !== key) {
      spoken.current = key;
      speak();
    }
  }, [state?.phase, state?.round, voice]);
  const theme = themes[state?.theme || "noir"],
    me = state?.me ?? {
      id: "",
      role: null,
      alive: false,
      clue: null,
      action: null,
      vote: null,
    },
    isHost = state?.host === me?.id,
    active = me?.alive,
    phase = state?.phase || "lobby";
  return (
    <div className={`app ${state?.theme || "noir"}`}>
      <header>
        <a className="brand" href="/">
          ◈ <span>MIDNIGHT COUNCIL</span>
        </a>
        <div className="header-actions">
          <span className={connected ? "online" : "offline"}>
            {connected ? "● Connected" : "● Reconnecting"}
          </span>
          <button className="quiet" onClick={() => setRules(true)}>
            How to play
          </button>
        </div>
      </header>
      <main>
        {error && (
          <div className="error" role="alert">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        {!state ? (
          <>
            <section className="hero">
              <div className="eyebrow">
                A MULTIPLAYER GAME OF TRUST & DECEPTION
              </div>
              <h1>
                Someone at the table
                <br />
                <em>has a secret.</em>
              </h1>
              <p>
                Gather your friends. Survive the night. Find the truth.
                <br />
                5–12 players · No accounts · Play on any device
              </p>
            </section>
            <section className="entry panel">
              <div>
                <h2>Take your seat</h2>
                <label>
                  Display name
                  <input
                    maxLength={24}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="What should we call you?"
                  />
                </label>
                <label>Choose your portrait</label>
                <div className="portraits">
                  {portraits.map((p, i) => (
                    <button
                      key={i}
                      aria-label={`Portrait ${i + 1}`}
                      className={avatar === i ? "selected" : ""}
                      onClick={() => setAvatar(i)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <label className="color-label">
                  Your accent color
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  />
                </label>
              </div>
              <div className="entry-options">
                <h3>Start a new story</h3>
                <p>Create a private room and invite your friends.</p>
                <button
                  className="primary"
                  disabled={!connected || !name.trim()}
                  onClick={() => send("create", { name, avatar, color })}
                >
                  Create room <span>↗</span>
                </button>
                <div className="divider">OR JOIN YOUR FRIENDS</div>
                <label>
                  Room code
                  <input
                    className="code-input"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ABCDEF"
                  />
                </label>
                <button
                  disabled={!connected || !name.trim() || code.length !== 6}
                  onClick={() => send("join", { name, avatar, color, code })}
                >
                  Join room →
                </button>
              </div>
            </section>
            <p className="footer-note">
              Three worlds. One question: who can you trust?
            </p>
          </>
        ) : (
          <>
            <section className="room-heading">
              <div>
                <div className="eyebrow">
                  {theme.title} /{" "}
                  {phase === "lobby" ? "THE GATHERING" : `ROUND ${state.round}`}
                </div>
                <h1>
                  {phase === "lobby"
                    ? "The table is waiting."
                    : phase === "ended"
                      ? "The truth comes to light."
                      : phase === "night"
                        ? "Keep your secrets close."
                        : phase === "morning"
                          ? "The morning report."
                          : phase === "discussion"
                            ? "Who do you trust?"
                            : "Make your choice."}
                </h1>
                <p>{theme.subtitle}</p>
              </div>
              <button
                className="room-code"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(state.code)
                    .catch(() => setError("Room code: " + state.code));
                }}
              >
                ROOM CODE<strong>{state.code}</strong>
                <small>Tap to copy</small>
              </button>
            </section>
            {phase === "lobby" ? (
              <div className="lobby-grid">
                <section className="panel">
                  <div className="section-title">
                    <h2>The guest list</h2>
                    <span>{state.players.length}/12 seats</span>
                  </div>
                  <Roster state={state} theme={theme} />
                  {isHost &&
                    state.players
                      .filter((p) => p.id !== me.id)
                      .map((p) => (
                        <button
                          className="quiet remove"
                          key={p.id}
                          onClick={() => send("remove", { id: p.id })}
                        >
                          Remove {p.name}
                        </button>
                      ))}
                  <p className="muted">
                    Share the room code with friends. Everyone opens this
                    website on their own device.
                  </p>
                </section>
                <section className="panel">
                  <h2>Choose your world</h2>
                  {Object.entries(themes).map(([id, t]) => (
                    <button
                      disabled={!isHost}
                      className={`theme-choice ${state.theme === id ? "selected" : ""}`}
                      key={id}
                      onClick={() => send("theme", { theme: id })}
                    >
                      <span>
                        {id === "noir" ? "◈" : id === "space" ? "✧" : "⌁"}
                      </span>
                      <div>
                        <strong>{t.title}</strong>
                        <small>{t.subtitle}</small>
                      </div>
                    </button>
                  ))}
                  <button
                    className="primary"
                    disabled={!isHost || state.players.length < 5 || !connected}
                    onClick={() => send("start")}
                  >
                    {isHost ? "Begin the night →" : "Waiting for the host"}
                  </button>
                  <p className="muted">
                    {state.players.length < 5
                      ? `${5 - state.players.length} more players needed to begin.`
                      : "Everyone is here. Let the mystery begin."}
                  </p>
                  <button
                    className="quiet"
                    onClick={() => {
                      socket.emit("leave", {}, (res: Reply) => {
                        if (res.ok) {
                          localStorage.removeItem("council-session");
                          setState(null);
                        } else setError(res.error || "Something went wrong.");
                      });
                    }}
                  >
                    Leave room
                  </button>
                </section>
                <Chat state={state} text={text} setText={setText} send={send} />
              </div>
            ) : (
              <>
                <div className="phase-bar">
                  <span>
                    {phase === "ended" ? "MATCH COMPLETE" : phase.toUpperCase()}
                  </span>
                  {state.deadline && (
                    <strong>
                      {Math.max(0, Math.ceil((state.deadline - now) / 1000))}s
                    </strong>
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={voice}
                      onChange={(e) => {
                        setVoice(e.target.checked);
                        if (!e.target.checked && "speechSynthesis" in window)
                          speechSynthesis.cancel();
                      }}
                    />{" "}
                    Voice narrator
                  </label>
                </div>
                <div className="game-grid">
                  <div>
                    <section className="panel role-panel">
                      <div className="eyebrow">
                        {active ? "YOUR PRIVATE ROLE" : "YOU ARE SPECTATING"}
                      </div>
                      <h2>
                        {revealed
                          ? theme.roles[me.role || "citizen"]
                          : "A secret identity"}
                      </h2>
                      <button
                        className="quiet"
                        onClick={() => setRevealed(!revealed)}
                      >
                        {revealed ? "Hide role" : "Reveal my role"}
                      </button>
                      {revealed && <p>{description[me.role || "citizen"]}</p>}
                      {me.clue && (
                        <div className="clue">
                          Private investigation · Round {me.clue.round}
                          <br />
                          <strong>
                            {me.clue.name}:{" "}
                            {me.clue.mafia
                              ? "Mafia allegiance detected"
                              : "No Mafia allegiance detected"}
                          </strong>
                        </div>
                      )}
                    </section>
                    {phase === "morning" && state.recap && (
                      <section className="panel recap">
                        <div
                          className={`scene ${state.recap.incident ? "incident" : "safe"}`}
                          aria-label={
                            state.recap.incident
                              ? "Anonymous empty seat at dawn"
                              : "Council seats at dawn"
                          }
                        >
                          <div className="moon">◯</div>
                          <div className="skyline">▥ ▥ ▦ ▥ ▥</div>
                          <div className="silhouettes">
                            ♟ ♟ {state.recap.incident ? "▱" : "♟"} ♟ ♟
                          </div>
                          <span className="scene-stamp">
                            {state.recap.incident
                              ? "INCIDENT RECORDED"
                              : "NO CASUALTIES"}
                          </span>
                        </div>
                        <div className="eyebrow">
                          DAWN ARCHIVE / REPORT{" "}
                          {String(state.round).padStart(3, "0")}
                        </div>
                        <h2>
                          {state.recap.incident
                            ? "An empty seat."
                            : "Everyone made it through."}
                        </h2>
                        <p>{state.recap.text}</p>
                        {state.recap.victim && (
                          <p className="muted">
                            Public result: {state.recap.victim} was eliminated.
                          </p>
                        )}
                        <button onClick={speak}>
                          ▶ Read the morning report
                        </button>
                        <small className="muted">
                          The illustration is anonymous. It contains no secret
                          actions or role information.
                        </small>
                      </section>
                    )}
                    {phase === "ended" ? (
                      <section className="panel victory">
                        <div className="eyebrow">THE FINAL VERDICT</div>
                        <h2>
                          {state.winner === "mafia"
                            ? theme.roles.mafia
                            : "The citizens"}{" "}
                          win.
                        </h2>
                        <p>
                          {state.winner === "mafia"
                            ? "The hidden faction has taken control of the council."
                            : "Every member of the hidden faction has been eliminated."}
                        </p>
                        {isHost ? (
                          <button
                            className="primary"
                            onClick={() => send("rematch")}
                          >
                            Return to lobby for a rematch
                          </button>
                        ) : (
                          <p>Waiting for the host to open the next lobby.</p>
                        )}
                      </section>
                    ) : (
                      <section className="panel">
                        <h2>
                          {phase === "night"
                            ? "Your move"
                            : phase === "vote"
                              ? "Cast your vote"
                              : phase === "discussion"
                                ? "Bring your suspicions to the table"
                                : "Listen to the morning report"}
                        </h2>
                        <p>
                          {!active
                            ? "You have been eliminated. Watch the story unfold."
                            : phase === "night"
                              ? description[me.role || "citizen"]
                              : phase === "vote"
                                ? "Choose another living player or skip. You may change your vote until time expires."
                                : phase === "discussion"
                                  ? "Discuss in chat or aloud. Voting begins when the timer ends."
                                  : "Discussion begins after the morning report."}
                        </p>
                        {active &&
                          (phase === "vote" ||
                            (phase === "night" && me.role !== "citizen")) && (
                            <div className="targets">
                              {state.players
                                .filter(
                                  (p) =>
                                    p.alive &&
                                    ((phase === "night" &&
                                      me.role === "doctor") ||
                                      p.id !== me.id) &&
                                    (phase !== "night" ||
                                      me.role !== "mafia" ||
                                      p.role !== "mafia"),
                                )
                                .map((p) => (
                                  <button
                                    key={p.id}
                                    disabled={!connected}
                                    className={
                                      (phase === "vote"
                                        ? me.vote
                                        : me.action) === p.id
                                        ? "selected"
                                        : ""
                                    }
                                    onClick={() =>
                                      send("action", { target: p.id })
                                    }
                                  >
                                    {portraits[p.avatar]} {p.name}
                                    {(phase === "vote"
                                      ? me.vote
                                      : me.action) === p.id
                                      ? " ✓"
                                      : ""}
                                  </button>
                                ))}
                              {phase === "vote" && (
                                <button
                                  className={
                                    me.vote === "skip" ? "selected" : ""
                                  }
                                  onClick={() =>
                                    send("action", { target: "skip" })
                                  }
                                >
                                  Skip elimination
                                </button>
                              )}
                            </div>
                          )}
                        {(phase === "night"
                          ? me.action
                          : phase === "vote"
                            ? me.vote
                            : null) && (
                          <p className="muted">
                            Selection saved. You can change it before the timer
                            ends.
                          </p>
                        )}
                      </section>
                    )}
                    <section className="panel">
                      <h2>Council record</h2>
                      {state.events.length ? (
                        state.events.map((e, i) => (
                          <p className="event" key={i}>
                            <small>ROUND {e.round}</small>
                            {e.text}
                          </p>
                        ))
                      ) : (
                        <p className="muted">The story has just begun.</p>
                      )}
                    </section>
                  </div>
                  <aside>
                    <section className="panel">
                      <h2>The council</h2>
                      <Roster state={state} theme={theme} />
                    </section>
                    <Chat
                      state={state}
                      text={text}
                      setText={setText}
                      send={send}
                    />
                  </aside>
                </div>
              </>
            )}
          </>
        )}
      </main>
      <footer>
        ◈ MIDNIGHT COUNCIL <span>A little suspicion goes a long way.</span>
      </footer>
      {rules && (
        <div className="modal-backdrop">
          <section
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-title"
          >
            <button
              className="close"
              aria-label="Close rules"
              onClick={() => setRules(false)}
            >
              ×
            </button>
            <div className="eyebrow">WELCOME TO THE COUNCIL</div>
            <h2 id="rules-title">Trust carefully. Play kindly.</h2>
            <p>
              Gather 5–12 friends. The host creates a room; everyone joins with
              the code. Roles are assigned secretly.
            </p>
            <h3>Night → Morning → Discussion → Vote</h3>
            <p>
              Mafia choose a target. The Detective checks allegiance. The Doctor
              protects someone, including themselves. Citizens wait. Night lasts
              45 seconds; morning 14; discussion 60; voting 30.
            </p>
            <p>
              At dawn, a protected target survives. Missing actions do nothing.
              Mafia selections use the most votes; a tie means no attack.
              Investigation results are private.
            </p>
            <p>
              During the day, discuss and vote. The most votes eliminate a
              player; ties or a winning skip produce no elimination. Eliminated
              roles are revealed.
            </p>
            <p>
              Citizens win when all Mafia are gone. Mafia win when their numbers
              equal or exceed the other survivors. There are 1 Mafia for 5–6
              players, 2 for 7–9, and 3 for 10–12.
            </p>
            <p>
              Eliminated players watch silently. Refresh to reconnect to your
              seat. Host control transfers after 30 seconds offline. A server
              restart ends rooms.
            </p>
            <p>
              The optional voice narrator uses your browser’s available voices.
              Morning art illustrates public outcomes only. No external AI
              service or voice account is required.
            </p>
            <button className="primary" onClick={() => setRules(false)}>
              I’m ready
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function Roster({
  state,
  theme,
}: {
  state: GameView;
  theme: typeof themes.noir;
}) {
  return (
    <div className="roster">
      {state.players.map((p) => (
        <div className={`person ${!p.alive ? "dead" : ""}`} key={p.id}>
          <div
            className="avatar"
            style={{ "--player-color": p.color } as React.CSSProperties}
          >
            {portraits[p.avatar]}
          </div>
          <div>
            <strong>
              {p.name}
              {p.id === state.me.id ? " (you)" : ""}
            </strong>
            <small>
              {!p.alive
                ? "Eliminated"
                : !p.connected
                  ? "Reconnecting"
                  : p.id === state.host
                    ? "Host"
                    : "At the table"}
              {p.role ? ` · ${theme.roles[p.role]}` : ""}
            </small>
          </div>
          {p.voted && state.phase === "vote" && (
            <span title="Vote submitted">✓</span>
          )}
        </div>
      ))}
    </div>
  );
}
function Chat({
  state,
  text,
  setText,
  send,
}: {
  state: GameView;
  text: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  send: (event: string, data?: Record<string, unknown>) => unknown;
}) {
  const enabled =
    state.me.alive && ["lobby", "discussion", "vote"].includes(state.phase);
  return (
    <section className="panel chat">
      <h2>Table talk</h2>
      <div className="messages" aria-live="polite">
        {state.chat.length ? (
          state.chat.map((m) => (
            <p key={m.id}>
              <strong>{m.name}</strong>
              <span>{m.text}</span>
            </p>
          ))
        ) : (
          <p className="muted">
            {enabled
              ? "Say hello to the council."
              : "Chat opens during discussion and voting."}
          </p>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) {
            send("chat", { text });
            setText("");
          }
        }}
      >
        <input
          aria-label="Chat message"
          disabled={!enabled}
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={enabled ? "Share a thought…" : "Quiet hours"}
        />
        <button disabled={!enabled || !text.trim()} aria-label="Send message">
          ↑
        </button>
      </form>
    </section>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
