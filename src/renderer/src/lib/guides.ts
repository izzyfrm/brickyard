/**
 * How to connect each provider. Commands are for Windows (the only platform the beta ships on).
 * Only commands that were checked against the real package or CLI are listed; when there is
 * no verified installer, the guide says where to look instead of guessing.
 */
export interface Guide {
  /** One line on what it is and what it costs. */
  about: string
  steps: { text: string; command?: string }[]
  link?: { label: string; url: string }
  /** Set when Brickyard detects the CLI but cannot chat with it yet. */
  limited?: string
}

export const GUIDES: Record<string, Guide> = {
  claude: {
    about: 'Anthropic’s coding agent. Needs a Claude subscription or an Anthropic API key.',
    steps: [
      { text: 'Install it', command: 'npm install -g @anthropic-ai/claude-code' },
      { text: 'Run it once and sign in in the browser window it opens', command: 'claude' }
    ],
    link: { label: 'Claude Code docs', url: 'https://docs.anthropic.com/en/docs/claude-code' }
  },
  codex: {
    about: 'OpenAI’s coding agent. Sign in with a ChatGPT plan or an OpenAI API key.',
    steps: [
      { text: 'Install it', command: 'npm install -g @openai/codex' },
      { text: 'Sign in', command: 'codex login' },
      { text: 'Pick a model your plan allows in Brickyard’s model chooser' }
    ],
    link: { label: 'Codex on GitHub', url: 'https://github.com/openai/codex' }
  },
  gemini: {
    about: 'Google’s coding agent. Has a free tier with a Google account.',
    steps: [
      { text: 'Install it', command: 'npm install -g @google/gemini-cli' },
      { text: 'Run it once and choose “Sign in with Google”', command: 'gemini' }
    ],
    link: { label: 'Gemini CLI on GitHub', url: 'https://github.com/google-gemini/gemini-cli' }
  },
  opencode: {
    about:
      'Open source agent that works with many model providers. Includes free models, no account needed.',
    steps: [
      { text: 'Install it', command: 'npm install -g @opencode/cli' },
      {
        text: 'Optional: sign in to a paid provider. Free models work without this.',
        command: 'opencode auth login'
      }
    ],
    link: { label: 'OpenCode on GitHub', url: 'https://github.com/anomalyco/opencode' }
  },
  grok: {
    about: 'xAI’s coding agent, Grok Build. Needs a grok.com account.',
    steps: [
      { text: 'Install Grok Build from xAI (it is not on npm)' },
      { text: 'Sign in', command: 'grok login' }
    ],
    link: { label: 'xAI', url: 'https://x.ai' }
  },
  nvidia: {
    about: 'Models hosted by NVIDIA, many with free endpoints. Runs through OpenCode.',
    steps: [
      {
        text: 'Install OpenCode, Brickyard’s engine for model hosts',
        command: 'npm install -g @opencode/cli'
      },
      { text: 'Create a free API key on build.nvidia.com' },
      { text: 'Paste it in “NVIDIA API key” below' }
    ],
    link: { label: 'build.nvidia.com', url: 'https://build.nvidia.com' }
  },
  ollama: {
    about:
      'Run models on your own PC, free and private. Speed depends on your hardware. Runs through OpenCode.',
    steps: [
      {
        text: 'Install OpenCode, Brickyard’s engine for model hosts',
        command: 'npm install -g @opencode/cli'
      },
      { text: 'Install Ollama from ollama.com and leave it running' },
      { text: 'Download a model that can use tools', command: 'ollama pull qwen2.5-coder' }
    ],
    link: { label: 'ollama.com', url: 'https://ollama.com' }
  },
  cursor: {
    about: 'Cursor’s command-line agent. Needs a Cursor account.',
    steps: [
      {
        text: 'Install it from PowerShell',
        command: "irm 'https://cursor.com/install?win32=true' | iex"
      },
      { text: 'Sign in', command: 'cursor-agent login' }
    ],
    link: { label: 'Cursor CLI docs', url: 'https://cursor.com/cli' },
    limited: 'Brickyard can find Cursor but cannot chat with it yet. Support is planned.'
  },
  muse: {
    about: 'Meta’s coding agent.',
    steps: [
      {
        text: 'Install Muse Code from Meta and sign in. Brickyard looks for a command named “muse”.'
      }
    ],
    limited:
      'Brickyard can find Muse Code but cannot chat with it yet. Until then, Meta’s models are available through OpenCode or a provider you add below.'
  },
  pi: {
    about: 'A small open source coding agent that works with many providers.',
    steps: [
      { text: 'Install it', command: 'npm install -g @mariozechner/pi-coding-agent' },
      { text: 'Run it once to set up a provider', command: 'pi' }
    ],
    link: { label: 'Pi on GitHub', url: 'https://github.com/badlogic/pi-mono' },
    limited: 'Brickyard can find Pi but cannot chat with it yet. Support is planned.'
  }
}

/** Starting points for "Add your own provider". All speak the OpenAI API. */
export const PRESETS: { name: string; baseURL: string; note: string }[] = [
  {
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    note: 'Hundreds of models, some free'
  },
  { name: 'Groq', baseURL: 'https://api.groq.com/openai/v1', note: 'Very fast open models' },
  { name: 'Together AI', baseURL: 'https://api.together.xyz/v1', note: 'Open models' },
  { name: 'DeepSeek', baseURL: 'https://api.deepseek.com/v1', note: 'DeepSeek’s own API' },
  { name: 'Mistral', baseURL: 'https://api.mistral.ai/v1', note: 'Mistral’s own API' },
  { name: 'LM Studio', baseURL: 'http://localhost:1234/v1', note: 'Models on this PC' }
]
