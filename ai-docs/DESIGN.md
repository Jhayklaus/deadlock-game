# Trust-No-One (TNO) - Design Document

## 1. Game Overview

**Trust-No-One** is a browser-based, real-time social deduction game for 7-20 players. It emphasizes social manipulation and deduction without requiring persistent accounts or complex setups.

### Core Rules
- **Teams**: 
  - **Informed Minority (Mafia)**: Know each other, aim to eliminate civilians until they hold a majority.
  - **Uninformed Majority (Civilians)**: Do not know who is who, aim to identify and vote out the Mafia.
- **Cycle**: The game loops between **Night** (covert actions) and **Day** (public discussion and voting).

### Win Conditions
- **Mafia Win**: Mafia count >= Civilian count.
- **Civilian Win**: All Mafia players are eliminated.

### Game Phases
1.  **Lobby**: Players join via link, set names. Host starts game.
2.  **Role Assignment**: Host distributes roles secretly.
3.  **Night**: 
    -   Mafia vote to kill.
    -   Special roles (Doctor, Detective) perform actions.
    -   Host resolves actions (Kill + Save = No Death).
4.  **Day Reveal**: Narrator (UI) announces who died (if anyone).
5.  **Day Discussion**: Timer-based free chat/voice (external).
6.  **Voting**: Players vote to eliminate a suspect. Majority required to lynch.
7.  **Verdict**: Target eliminated (role revealed/hidden based on settings). Loop to Night.

---

## 2. Role System

### Minimum Viable Roles
| Role | Team | Ability |
| :--- | :--- | :--- |
| **Mafia** | Mafia | Vote to kill one target each night. Private chat with other Mafia. |
| **Civilian** | Civ | No special abilities. Vote during the day. |
| **Detective** | Civ | Investigate one player each night to learn their alignment (Good/Bad). |
| **Doctor** | Civ | Protect one player each night from being killed. Cannot self-protect 2 nights in a row. |

### Advanced Roles (Post-MVP)
-   **Vigilante** (Civ): Can kill once per game at night.
-   **Jester** (Neutral): Wins if voted out during the day.

### Balancing (7-20 Players)
-   **Ratio**: Approx 1 Mafia per 3-4 Civilians.
-   **7 Players**: 2 Mafia, 1 Detective, 1 Doctor, 3 Civs.
-   **15+ Players**: 3-4 Mafia, add Vigilante/Jester.

---

## 3. Architecture Design

### Client-Only Architecture
-   **Topology**: **Host-Authoritative Star Network** (via WebRTC).
    -   One player (the creator) acts as the **Host**.
    -   All other players (Peers) connect directly to the Host.
    -   Host holds the "Master State".
-   **Peer-to-Peer Strategy**: 
    -   **Data Transport**: WebRTC Data Channels (reliable, ordered).
    -   **Signaling**: Minimal external signaling server (WebSocket/HTTP) required *only* to establish initial connections (SDP exchange). Once connected, signaling is not needed.
-   **State Synchronization**:
    -   **Pattern**: Deterministic State Machine.
    -   **Flow**:
        1.  Peer sends `Action` (e.g., `{ type: 'VOTE', target: 'PlayerB' }`) to Host.
        2.  Host validates action against current state and rules.
        3.  Host applies action, updates Master State.
        4.  Host broadcasts `StatePatch` or `NewState` to all Peers.
    -   **Secrecy**: Host sends sanitized state to clients (e.g., Client A does not receive the list of Mafia members unless they are Mafia).

---

## 4. Presence & Connection Handling

### "Online" Definition
-   A player is "Online" if their WebRTC Data Channel to the Host is `open`.

### Handling Tab Switching / Backgrounding
-   **Visibility API**: When `document.hidden` is true, the game continues running.
-   **Timers**: WebRTC connections usually stay alive in background tabs on desktop. Mobile browsers may throttle or kill connections after a timeout.
-   **Mitigation**: 
    -   Use `Page Visibility API` to flag "Away" status visually but keep game logic running.
    -   Aggressive `Keep-Alive` heartbeats (ping/pong) every 2 seconds to prevent NAT timeouts.

### Disconnections
-   **Peer Disconnect**: 
    -   Short (< 10s): Allow reconnect (using same Peer ID/Token stored in LocalStorage).
    -   Long (> 10s or Night Phase end): Mark as "Suicide/Left Town". Role revealed.
-   **Host Disconnect**: 
    -   **MVP**: Game Aborts. "Host disconnected."
    -   **Future**: State Transfer. Host designates a "Vice Host" who receives full state copies. If Host drops, Vice Host promotes to Host.

---

## 5. No-Backend Feasibility Check

### Feasibility Matrix
| Feature | Pure Client (Local Network) | Client + Public Signaling | Needs DB/Auth |
| :--- | :---: | :---: | :---: |
| Gameplay | ✅ | ✅ | ❌ |
| Discoverability (Lobby Code) | ❌ | ✅ (via Signaling) | ❌ |
| Persistence (Stats/History) | ✅ (Local Only) | ✅ (Local Only) | ✅ |
| Cheat Prevention | ⚠️ (Host Trusted) | ⚠️ (Host Trusted) | ✅ |

### The "Absolute Minimum" Backend
-   **Signaling Server**: Essential for WebRTC over Internet.
    -   *Recommendation*: Use a hosted service like **PeerJS Cloud** (free tier limited) or deploy a tiny Node.js WebSocket server (approx 100 lines of code) to a free platform (e.g., Render/Fly.io/Glitch).
    -   *Traffic*: Minimal. Only JSON blobs for SDP exchange (handshake). No game data flows through here.

### Constraints
-   **IP Leakage**: WebRTC reveals IP addresses to other players.
-   **Host Trust**: The Host machine controls the game. If the Host hacks their client, they can see all roles. (Acceptable for casual games).

---

## 6. Security & Abuse Considerations

### Cheating Risks
-   **Client-Side Modding**: A player could modify their UI to reveal hidden HTML elements.
    -   *Defense*: **Server-Authoritative State (Host)**. The Host must *never* send hidden information (like "Player C is Mafia") to a Civilian client. Only send what they are allowed to know.
-   **Multi-Accounting**: One person opening multiple tabs.
    -   *Defense*: Difficult to prevent without Auth. Rely on social contract of private lobbies.

### Trust Boundaries
-   **Host**: Trusted Authority.
-   **Peers**: Untrusted. All inputs must be validated by Host.

---

## 7. Tech Stack Recommendation

-   **Language**: TypeScript (Strict)
-   **Frontend Framework**: **React** (Component-based UI) + **Vite** (Build Tool).
-   **State Management**: **Zustand** (Simple, lightweight, easy to bridge with network events).
-   **Networking**: **PeerJS** (Abstracts WebRTC complexity, provides Signaling).
-   **Styling**: **Tailwind CSS** (Rapid UI development).
-   **Deployment**: **Vercel** or **Netlify** (Static hosting).

---

## 8. MVP Build Plan

### Phase 1: Connectivity & Core Structure (Days 1-2)
-   Setup React + Vite + Tailwind.
-   Implement `NetworkManager` using PeerJS.
-   Create "Host Game" (Generate ID) and "Join Game" (Enter ID) flow.
-   Lobby UI: List connected players.

### Phase 2: Game Logic Engine (Days 3-4)
-   Implement `GameStore` (Zustand) with Host/Client logic separation.
-   Define State Machine: `Lobby` -> `Night` -> `Day` -> `Vote`.
-   Implement Role distribution algorithm.
-   Implement Voting mechanism.

### Phase 3: UI Polish & Resilience (Days 5-7)
-   Night Phase UI (Mafia selection, Doctor save).
-   Day Phase UI (Chat/Status, Voting Booth).
-   Handle refresh/reconnect (LocalStorage session recovery).
