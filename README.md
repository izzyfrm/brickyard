# Brickyard

A control surface for building Roblox games with the AI coding agents you already use.
Free and open source. **Beta.**

Brickyard does not ship a model and never sees your keys. It runs the agent CLIs that are
already installed and signed in on your PC, and gives them one window with Roblox Studio wired in.

## What it does

- **Chat with any agent**: Claude, Codex, Gemini, OpenCode and Grok, with streaming replies, tool cards and diffs.
- **Model chooser**: lists the models each CLI reports for your account.
- **Roblox Studio built in**: attaches the Studio MCP server per run, or uses the one already in the CLI's config.
- **Agents can call agents**: Claude and Codex can ask any other ready agent for a second opinion or a side task.
- **Code panel**: file tree, viewer, and git changes with per-file diffs.
- **Settings**: accent color, surface, text size, glow, grain, reduced motion.

## Requirements

- Windows 10 or 11 (the only platform tested so far)
- At least one agent CLI installed and signed in: `claude`, `codex`, `gemini`, `opencode` or `grok`
- Roblox Studio, for the Studio tools

## Develop

```bash
npm install
npm run dev
```

## Build the installer

```bash
npm run build:win
```

The installer lands in `dist/`. It is not code signed, so Windows SmartScreen will warn on first run.

## Access levels

| Level | What the agent may do |
|---|---|
| Plan only | Read and plan. Changes nothing. |
| Edit | Edit files and use Studio tools. Risky shell commands are denied. |
| Full access | No permission checks. Use it only on a project you have backed up. |

Agents run headless, so Brickyard cannot show an approval prompt yet. In Edit mode an action that
would need approval is refused, not asked about.

## Known limits

- Cursor, Muse Code and Pi are detected but have no chat adapter yet.
- Only Claude and Codex can call other agents. Any ready agent can be called.
- An agent called by another agent never gets Roblox Studio tools.
- No auto-update. Install a new version over the old one.
- Studio itself has no undo for agent edits. Save a copy of your place first.

## How it is built

- `src/main/adapters.ts`: one adapter per CLI (arguments in, streamed JSON out)
- `src/main/agents.ts`: runs a turn and forwards events to the window
- `src/main/agent-mcp.ts`: the stdio MCP server agents use to call each other
- `src/renderer`: React, Tailwind, Base UI, Motion

## Trademarks

Brickyard is not affiliated with, endorsed by or sponsored by Roblox Corporation, Anthropic, OpenAI,
Google, xAI or any other company named here. Product names and logos belong to their owners and are
shown only to identify which tool is which. Provider logos come from `@lobehub/icons-static-svg` (MIT)
and `simple-icons` (CC0).

## License

MIT
