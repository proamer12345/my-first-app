export type Role = "mafia" | "detective" | "doctor" | "citizen";
export type Theme = "noir" | "space" | "cyber";
export type Phase =
  | "lobby"
  | "night"
  | "morning"
  | "discussion"
  | "vote"
  | "ended";
export interface PublicPlayer {
  id: string;
  name: string;
  avatar: number;
  color: string;
  alive: boolean;
  connected: boolean;
  role: Role | null;
  voted: boolean;
}
export interface GameView {
  serverNow: number;
  code: string;
  host: string;
  theme: Theme;
  phase: Phase;
  round: number;
  deadline: number | null;
  winner: "mafia" | "citizens" | null;
  recap: {
    round: number;
    incident: boolean;
    text: string;
    victim: string | null;
  } | null;
  events: { round: number; text: string }[];
  chat: { id: number; name: string; text: string }[];
  me: {
    id: string;
    role: Role | null;
    alive: boolean;
    clue: { round: number; name: string; mafia: boolean } | null;
    action: string | null;
    vote: string | null;
  };
  players: PublicPlayer[];
}
export interface Reply {
  ok: boolean;
  error?: string;
  token?: string;
  code?: string;
}
