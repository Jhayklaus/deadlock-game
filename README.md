# MAFIEUX

**MAFIEUX** (FKA Trust-No-One) is a browser-based, real-time social deduction game inspired by Mafia and Werewolf. Players are randomly assigned roles and must work together (or deceive one another) to win. The game features a host-authoritative architecture with real-time communication powered by Socket.IO.

## 🎲 Game Modes

| Mode | Players | What it is |
|---|---|---|
| **Mafieux** — Classic Mafia | 7–20 | The original. Secret roles, night kills, trials and lynchings. |
| **Word Impostor** | 5–15 | Crewmates share a secret word. The impostor knows only the category. |
| **Undercover** | 6–12 | Two near-identical words, and one player with no word at all. |
| **Frequency Spy** | 5–12 | Everyone shares a secret number on a spectrum. One spy is far off. |
| **Deadlock** — Station Crisis | 5–12 | Move around a station, run tasks, and watch your back. |

Every mode has a built-in walkthrough that explains its rules, shown
automatically the first time you play it.

## 🎮 Game Overview

In **MAFIEUX**, players are divided into two main factions: the **Town** and the **Mafia**.
- **Town:** Must identify and eliminate the Mafia members before they take over.
- **Mafia:** Must eliminate the Town members while keeping their identities secret.
- **Neutral Roles:** Special roles with their own unique winning conditions (e.g., Serial Killer, Jester).

The game cycles through **Day** and **Night** phases:
- **Night:** Special roles perform actions (Kill, Save, Investigate).
- **Day:** All players discuss and vote to eliminate a suspect.

## ✨ Key Features

- **Real-time Multiplayer:** Seamless communication using Socket.IO.
- **Role-Based Mechanics:** 18 roles — Detective, Doctor, Bodyguard, Vigilante, Mayor, Medium, Escort, Veteran, Lookout, Spy, Framer, Serial Killer, Jester, Survivor, Executioner, Witch and more.
- **Trials:** The accused gets a defense window, then the town votes guilty, innocent or abstain. A tie acquits.
- **Night Tasks:** Players with no night action get a short minigame instead of watching a timer. Meet the town's quota and discussion runs longer the next day.
- **Dynamic Game Phases:** Lobby, Role Assignment, Night, Day Discussion, Voting, Trial, and Elimination Reveal.
- **Host Migration:** If the host closes their tab, a surviving player takes over and the game continues.
- **Chat Systems:**
  - **Global Chat:** For public discussion.
  - **Mafia Chat:** Private channel for Mafia members.
  - **Whisper System:** Private messaging between players.
  - **Dead Chat:** For eliminated players (and the Medium).
- **Mobile-First Design:** Responsive UI with specialized mobile chat drawers and optimized layouts.
- **Host Controls:** Kick players, add bots, and customize game settings.
- **Smart AI Bots:** Intelligent bots powered by LLMs (Gemini/DeepSeek) that converse, vote, and perform night actions based on their role and personality.

## 🤖 Smart AI Integration

MAFIEUX now features intelligent bots that go beyond random actions:
- **Natural Language Processing:** Bots chat naturally in Global, Mafia, and Dead channels.
- **Context Awareness:** They read the chat history and game events to make informed decisions.
- **Personality System:** Each bot has a unique personality (e.g., Aggressive, Analytical, Chaotic).
- **Role-Playing:** Bots understand their roles (Town, Mafia, Neutral) and act/speak accordingly.
- **Typing Indicators:** Real-time feedback when bots are "typing" a response.

## 🛠️ Tech Stack

This project uses a modern web development stack:

### Frontend
- **Framework:** [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) + [clsx](https://www.npmjs.com/package/clsx) / [tailwind-merge](https://www.npmjs.com/package/tailwind-merge)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Language:** TypeScript

### Backend
- **Runtime:** Node.js
- **Server:** Express.js
- **Real-time Engine:** [Socket.IO](https://socket.io/)
- **AI:** Google Gemini / DeepSeek (via OpenAI SDK)

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/mafieux.git
   cd mafieux
   ```

2. **Install Frontend Dependencies**
   ```bash
   npm install
   ```

3. **Install Backend Dependencies**
   Navigate to the server directory and install dependencies:
   ```bash
   cd server
   npm install
   cd ..
   ```

4. **Environment Configuration**
   Create a `.env` file in the `server` directory. **Every key here is
   optional** — the game runs without any of them.

   ```env
   PORT=3001

   # Optional: smart AI bots. Without it, bots use built-in behaviour.
   DEEP_SEEK_API_KEY=your_deepseek_key_here

   # Optional: in-app voice chat. Without these, voice is simply not offered.
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=your_livekit_key
   LIVEKIT_API_SECRET=your_livekit_secret
   ```

   Check what the server has enabled at any time:
   ```bash
   curl http://localhost:3001/api/health
   # {"ok":true,"ai":"ready","voice":"ready"}
   ```

### 🎙️ In-App Voice (optional)

With LiveKit credentials configured, the game routes voice itself rather than
sending players to an external call. Because the game controls the audio, the
phase rules are **enforced** rather than agreed:

| Phase | Who can speak |
|---|---|
| Day / voting / verdict | Every living player, in the Town channel |
| Night | Mafia only, in their own channel — nobody else has a mic |
| Trial defense | The accused alone. Everyone else listens |
| Any phase, if dead | The Dead channel, never audible to the living |

Each channel is a separate LiveKit room, and tokens are minted from the host's
authoritative game state — so a client cannot talk its way into the Mafia's
night channel. Players always join muted.

Get free credentials at [livekit.io](https://livekit.io), or self-host with
their Docker image to avoid the free tier's limits. If you would rather not run
voice at all, the host can paste a Meet/Zoom/Discord link in the lobby instead
and everyone gets a Join button.

### Running the Project

You need to run both the frontend and backend servers.

1. **Start the Backend Server**
   Open a terminal and run:
   ```bash
   cd server
   npm start
   ```
   The server will start on port 3001 (default).

2. **Start the Frontend Development Server**
   Open a new terminal window and run:
   ```bash
   npm run dev
   ```

## 📖 How to Play

1. **Host a Game:** Create a lobby and share the Room ID with friends.
2. **Join a Game:** Enter a Room ID to join an existing lobby.
3. **Setup:** The host can configure game settings (role counts, phase durations) and add bots if needed.
4. **Start:** Once everyone is ready, the host starts the game.
5. **Night Phase:** Special roles act — the Mafia pick a target, the Doctor
   protects, the Detective investigates, the Escort blocks, the Veteran can go
   on alert. Everyone else gets a quick task to pass the time.
6. **Day Phase:** Discuss who the Mafia might be.
7. **Voting:** The leading candidate goes on trial, defends themselves, and the
   town returns a verdict. (Hosts can turn trials off for a faster game.)
8. **Win:** The game ends when one faction meets their win condition.

> **Night order matters.** Roleblocks land before the actions they cancel,
> frames before the investigations they corrupt, and protection before the
> attacks it absorbs — so an Escort blocking the Doctor lets the Mafia kill
> through, and a Framer's mark reads as Mafia however innocent they are.

## 🤝 Contact

If you have any questions, feel free to reach out!

**Email:** [jamiumoyosore02@gmail.com](mailto:jamiumoyosore02@gmail.com)
