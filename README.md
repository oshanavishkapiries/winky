# Winky 🌟

AI-powered browser automation agent with a plug-and-play tool architecture. Built with Playwright-core, Agent Client Protocol (ACP), and OpenAI/OpenRouter.

## Features

- 🔌 **Plug-and-Play Tools**: 28 browser automation tools, easily extensible
- 🤖 **LLM-Powered**: Works with OpenAI and OpenRouter
- 🌐 **ACP Compatible**: Integrates with editors like Zed
- 📝 **Structured Logging**: Separate logs for workflow, LLM, and browser actions
- 🎭 **Profile Support**: Persistent browser profiles with cookies and sessions
- ⚙️ **Type-Safe Config**: Zod-validated configuration

## Installation

```bash
npm install
```

## Configuration

Create or edit `winky.config.ts`:

```typescript
import type { WinkyConfig } from "./src/config/schema";

const config: WinkyConfig = {
  llm: {
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY || "your-api-key",
    model: "gpt-4o",
  },
  browser: {
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: false,
    defaultProfile: "default",
  },
  logging: {
    level: "info",
    retentionDays: 7,
  },
  acp: {
    enabled: true,
    agentName: "winky",
    agentTitle: "Winky Browser Agent",
  },
};

export default config;
```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## Tool Categories

Winky includes 28 browser automation tools across 6 categories:

- **Navigation** (3): navigate, navigate_back, tabs
- **Interaction** (9): click, type, hover, drag, select_option, press_key, fill_form, handle_dialog, file_upload
- **Resources** (5): snapshot, screenshot, console_messages, network_requests, pdf_save
- **Utility** (6): close, resize, evaluate, run_code, wait_for, install
- **Testing** (5): generate_locator, verify_element, verify_text, verify_list, verify_value
- **Mouse** (6): click_xy, move_xy, drag_xy, mouse_down, mouse_up, mouse_wheel

## Architecture

```
src/
├── browser/          # Browser management (Playwright-core)
├── tools/            # 28 plug-and-play browser tools
├── llm/              # LLM provider abstraction
├── agent/            # Orchestrator (Plan → Act → Observe)
├── acp/              # Agent Client Protocol server
├── config/           # Zod-validated configuration
└── logger/           # Winston logging (3 transports)
```

## License

MIT
