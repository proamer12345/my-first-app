# Midnight Council

A playable, server-authoritative social deduction game for 5–12 friends. Create a private room, share its code, and play across phones and desktop browsers. No accounts required.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open port 3000 in your browser. Devices on your local network can join using your computer's LAN IP and port 3000, provided the firewall allows it. Each player needs their own browser session. `npm test` runs game-rule tests; `npm run build` builds the browser app. `npm run typecheck` checks the TypeScript client. `npm run test:browser` runs the five-session full match and narrator checks against a running server; install Chromium and set `CHROMIUM_PATH` if it is not `/usr/bin/chromium`. `npm start` serves the production build and multiplayer connections together.

## Gameplay

5–6 players: 1 Mafia; 7–9: 2; 10–12: 3. Each match also has 1 Detective and 1 Doctor. All others are Citizens. Night (45 seconds), morning (14 seconds), discussion (60 seconds), vote (30 seconds). Mafia selections and day votes use a unique plurality; ties cause no elimination. A winning skip vote causes no elimination. Doctor may protect themselves. Detective receives a private allegiance result. Eliminated roles are public. Mafia win at parity; Citizens win when all Mafia are eliminated. In-game rules explain the full flow.

## Voice and recap

Optional narration uses browser SpeechSynthesis: no API key or external AI generation. Narration scripts are generated from public outcomes. Voice support and available voices vary by browser; enable narration through the checkbox, or press the report button. The written recap always works. Themed CSS scenes illustrate an anonymous incident or safe dawn, without depicting attackers, targets, investigators, or protectors. The public elimination name appears separately in the report.

## Deploy on Render

Push this repository to GitHub, then create a Render Blueprint using `render.yaml`, or create one Node web service manually:

- Build: `npm ci --include=dev && npm run build`
- Start: `npm start`
- Environment: `NODE_ENV=production`
- Health endpoint: `/health`

The checked-in Blueprint selects a paid Starter instance. Review current pricing before creating it. The server reads Render's `PORT` and binds to all interfaces. Render supplies HTTPS and WebSocket support; no database or secret is required. Share the resulting HTTPS URL. Create a room on one device and join its code on a second; use at least five independent sessions to exercise a complete match.

## Architecture and limits

React/TypeScript/Vite client, Express/Socket.IO server, regular CSS theme variables. The server validates role actions and sends personalized snapshots. Reconnect tokens live in browser localStorage; do not share them. Host control transfers after 30 seconds offline. Disconnected seats remain reserved during a match; lobby hosts can remove seats. Chat is available only in lobby, discussion, and voting to living players.

Run **one server instance**, without autoscaling: rooms live in memory. Server restart/deploy ends active rooms. Empty rooms expire after one hour. Persistence, distributed scaling, moderation, and generated AI audio/art are future extensions. Browser voices may be unavailable or require a user gesture. No voice API costs are incurred.

## Animated interface

Each theme has a lightweight CSS atmosphere: Noir rain and streetlight flicker, Deep Space dust and stars, and Cyberpunk scanning gridlines. Phase changes use native View Transitions where supported and CSS entrances and curtains as a fallback. The private dossier flips, selections glow, and public ballot-submission totals and stamps animate without exposing vote targets. Morning scenes develop with a typewriter report and soft alert pulses. The interface respects `prefers-reduced-motion`, showing complete reports immediately and revealing dossiers without movement.

With the server running, `npm run test:animations` checks all themes, mobile overflow, dossier controls, public recap effects, ballot feedback, and reduced-motion behavior using real multiplayer phases.
