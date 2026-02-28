# Sage — AI Study Agent

A local AI-powered study tutor for IT and tech certifications. Sage is a conversational agent that runs on your machine — it asks questions, explains concepts, tracks your progress, and adapts to what you know and don't know.

Built on [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with a Claude Max subscription. Everything runs locally. No data leaves your machine.

## How it works

```
Browser (Lit + Vite)  ←→  Bridge Server (Express + WebSocket)  ←→  Claude Agent SDK  ←→  MCP Server (SQLite)
```

- **Browser** — Chat interface with interactive quiz cards (multiple choice, short answer, matching), mastery dashboard, session history
- **Bridge Server** — Connects the UI to Claude via the Agent SDK, parses quiz blocks, serves REST endpoints for sidebar data
- **MCP Server** — Exposes study tools (record answers, track mastery, manage sessions) to the Claude agent via Model Context Protocol
- **SQLite** — Local database storing certification objectives, per-objective mastery scores, answer history, and session records

## Prerequisites

- **Node.js 22+** — [download](https://nodejs.org/) or use `nvm install 22`
- **pnpm** — `npm install -g pnpm`
- **Claude Max subscription** — Sage uses the Claude Agent SDK with an OAuth token from Claude Code
- **C++ build tools** — required by `better-sqlite3` (native addon):
  - **macOS**: Xcode Command Line Tools (usually preinstalled; if not: `xcode-select --install`)
  - **Windows**: Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **"Desktop development with C++"** workload selected. Or run this from an admin PowerShell:
    ```powershell
    npm install -g windows-build-tools
    ```
  - **Linux**: `sudo apt install build-essential python3` (Debian/Ubuntu) or equivalent

## Setup

### 1. Clone and install

```bash
git clone https://github.com/YureiDragon/sage-study-agent.git
cd sage-study-agent
pnpm install
```

> **Windows note**: If `pnpm install` fails with `node-gyp` errors, make sure the C++ build tools above are installed, then restart your terminal and try again.

### 2. Get your Claude Code OAuth token

Sage authenticates through Claude Code's OAuth flow. You need an active [Claude Max](https://claude.ai) subscription.

```bash
# If you haven't already, install Claude Code
npm install -g @anthropic-ai/claude-code

# Run the auth setup
claude setup-token
```

This prints a token starting with `sk-ant-oat01-...`. Copy it.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and paste your token:

```
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-your-token-here
```

Optional settings:
```
# Bridge server port (default: 3578)
PORT=3578

# Claude model: sonnet, opus, or haiku (default: sonnet)
CLAUDE_MODEL=sonnet
```

### 4. Customize the tutor personality (optional)

On first run, `soul.example.md` is automatically copied to `soul.md`. This file defines Sage's personality, teaching style, and behavior. Edit `soul.md` to customize — it's gitignored so your changes stay local.

### 5. Start the dev server

```bash
pnpm dev
```

This starts two processes:
- **Vite dev server** on `http://localhost:5173` (open this in your browser)
- **Bridge server** on port 3578 (proxied through Vite)

On first startup, certification data from `data/certs/` is automatically imported into the local SQLite database.

## Usage

1. Open `http://localhost:5173`
2. Enter your name and select a certification
3. Choose a study mode:
   - **Quiz Mode** — 10 focused questions on your weakest areas
   - **Review Mode** — Sage teaches a weak topic, then tests understanding
   - **Quick Check** — 3-5 rapid-fire questions for reinforcement
4. Answer questions in the interactive quiz panel
5. Chat freely with Sage between quizzes — ask for explanations, request specific topics, or just talk through concepts
6. End the session when done — Sage summarizes what was covered and saves your progress

Your mastery data persists between sessions in the local SQLite database. Sage checks your history at the start of each session to pick up where you left off.

## Adding certifications

Certification data lives in `data/certs/` as JSON files. Each file defines an exam's domains, objectives, and metadata. See the existing CompTIA A+ files for the format.

To import a new cert after adding its JSON:

```bash
pnpm import-cert data/certs/your-cert.json
```

Or just restart the dev server — it auto-imports any new certs on startup.

## Project structure

```
src/
  bridge/         # WebSocket server, Claude SDK wrapper, protocol types
  mcp/            # MCP server with study tools, SQLite database layer
  ui/
    components/   # Lit web components (chat, quiz, sidebar, welcome)
    services/     # WebSocket client, markdown extensions
    styles/       # Global CSS
  shared/         # Shared TypeScript types
scripts/          # Dev server, cert import utilities
data/certs/       # Certification definition files (JSON)
soul.example.md   # Default tutor personality template
```

## Privacy and security

- **Runs entirely on your machine** — the bridge server, database, and agent all run locally
- **No external data storage** — study progress lives in a local SQLite file (`data/study.db`)
- **OAuth token stays local** — your `.env` file is gitignored and never committed
- **Claude API calls** — conversation goes through Anthropic's API (same as using Claude Code directly). No third-party services involved

## License

[MIT](LICENSE)
