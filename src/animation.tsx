import { useEffect, useState } from "react";
import type { Phase } from "./types";
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}
export function Atmosphere() {
  return (
    <div className="atmosphere" aria-hidden="true">
      <div className="ambient-light" />
      <div className="ambient-grid" />
      {Array.from({ length: 28 }, (_, i) => (
        <i
          key={i}
          className="particle"
          style={
            {
              "--x": `${(i * 37 + 11) % 100}%`,
              "--y": `${(i * 23 + 7) % 100}%`,
              "--delay": `${-i * 0.73}s`,
              "--duration": `${5 + (i % 7)}s`,
              "--scale": `${0.5 + (i % 4) * 0.25}`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
const messages: Record<Phase, string> = {
  lobby: "Take your seat",
  night: "Night falls",
  morning: "Dawn breaks",
  discussion: "The council convenes",
  vote: "Every choice matters",
  ended: "The final verdict",
};
export function PhaseCurtain({
  phase,
  round,
}: {
  phase: Phase;
  round: number;
}) {
  return (
    <div
      key={`${phase}:${round}`}
      className={`phase-curtain curtain-${phase}`}
      aria-hidden="true"
    >
      <span>{messages[phase]}</span>
    </div>
  );
}
export function RoleDossier({
  revealed,
  toggle,
  title,
  description,
}: {
  revealed: boolean;
  toggle: () => void;
  title: string;
  description: string;
}) {
  return (
    <div className="dossier">
      <button
        className={`dossier-toggle ${revealed ? "is-revealed" : ""}`}
        aria-expanded={revealed}
        aria-label={revealed ? "Hide role" : "Reveal my role"}
        onClick={toggle}
      >
        <span className="dossier-flipper">
          <span className="dossier-face dossier-cover" aria-hidden="true">
            <span className="dossier-emblem">◈</span>
            <span>CLASSIFIED</span>
            <small>Tap to open your dossier</small>
          </span>
          <span className="dossier-face dossier-inside" aria-hidden="true">
            <span className="dossier-emblem">✧</span>
            <span>IDENTITY VERIFIED</span>
            <small>Tap to seal your dossier</small>
          </span>
        </span>
      </button>
      <div className="dossier-copy" key={String(revealed)}>
        <h2>{revealed ? title : "A secret identity"}</h2>
        {revealed ? (
          <p>{description}</p>
        ) : (
          <p className="muted">
            For your eyes only. Open your private dossier.
          </p>
        )}
      </div>
    </div>
  );
}
export function Typewriter({ text }: { text: string }) {
  const reduced = useReducedMotion();
  const [count, setCount] = useState(reduced ? text.length : 0);
  useEffect(() => {
    if (reduced) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let n = 0;
    const timer = setInterval(() => {
      n = Math.min(text.length, n + 2);
      setCount(n);
      if (n === text.length) clearInterval(timer);
    }, 24);
    return () => clearInterval(timer);
  }, [text, reduced]);
  return (
    <p className="typewriter">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, count)}
        <span
          className={
            count < text.length ? "typing-cursor" : "typing-cursor finished"
          }
        >
          ▍
        </span>
      </span>
    </p>
  );
}
