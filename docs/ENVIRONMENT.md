# Environment Variables Setup

## Quick Start

1. **Copy the example file**:

   ```bash
   cp .env.example .env
   ```

2. **Add your API key**:

   ```bash
   # Edit .env and add your OpenAI API key
   OPENAI_API_KEY=sk-proj-your-actual-key-here
   ```

3. **Run Winky**:
   ```bash
   npm run dev
   ```

---

## Available Environment Variables

### LLM Configuration

| Variable             | Required | Default  | Description                                                                     |
| -------------------- | -------- | -------- | ------------------------------------------------------------------------------- |
| `WINKY_LLM_PROVIDER` | No       | `openai` | LLM provider: `openai` or `openrouter`                                          |
| `OPENAI_API_KEY`     | Yes\*    | -        | OpenAI API key from [platform.openai.com](https://platform.openai.com/api-keys) |
| `OPENROUTER_API_KEY` | Yes\*    | -        | OpenRouter API key from [openrouter.ai](https://openrouter.ai/keys)             |
| `WINKY_LLM_MODEL`    | No       | `gpt-4o` | Model name (e.g., `gpt-4-turbo`, `gpt-3.5-turbo`)                               |
| `WINKY_LLM_BASE_URL` | No       | -        | Custom API base URL (for OpenRouter)                                            |

\*One of `OPENAI_API_KEY` or `OPENROUTER_API_KEY` is required depending on provider

### Browser Configuration

| Variable                        | Required | Default   | Description                                                               |
| ------------------------------- | -------- | --------- | ------------------------------------------------------------------------- |
| `WINKY_BROWSER_EXECUTABLE_PATH` | No       | (bundled) | Path to browser executable. Leave empty for Playwright's bundled Chromium |
| `WINKY_BROWSER_HEADLESS`        | No       | `false`   | Run browser in headless mode (`true`/`false`)                             |
| `WINKY_BROWSER_PROFILE`         | No       | `default` | Browser profile name                                                      |
| `WINKY_BROWSER_VIEWPORT_WIDTH`  | No       | `1280`    | Browser viewport width                                                    |
| `WINKY_BROWSER_VIEWPORT_HEIGHT` | No       | `720`     | Browser viewport height                                                   |

### Logging Configuration

| Variable                   | Required | Default | Description                                 |
| -------------------------- | -------- | ------- | ------------------------------------------- |
| `WINKY_LOG_LEVEL`          | No       | `info`  | Log level: `error`, `warn`, `info`, `debug` |
| `WINKY_LOG_RETENTION_DAYS` | No       | `7`     | Number of days to keep logs                 |

### ACP Configuration

| Variable                | Required | Default               | Description                        |
| ----------------------- | -------- | --------------------- | ---------------------------------- |
| `WINKY_ACP_ENABLED`     | No       | `false`               | Enable ACP server (`true`/`false`) |
| `WINKY_ACP_AGENT_NAME`  | No       | `winky`               | ACP agent name                     |
| `WINKY_ACP_AGENT_TITLE` | No       | `Winky Browser Agent` | ACP agent title                    |

### Memory Configuration

| Variable               | Required | Default                | Description                               |
| ---------------------- | -------- | ---------------------- | ----------------------------------------- |
| `WINKY_MEMORY_ENABLED` | No       | `true`                 | Enable persistent memory (`true`/`false`) |
| `WINKY_MEMORY_DB_PATH` | No       | `data/memory/winky.db` | SQLite database path                      |

---

## Examples

### OpenAI with GPT-4

```bash
WINKY_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-your-key-here
WINKY_LLM_MODEL=gpt-4o
```

### OpenRouter with Claude

```bash
WINKY_LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-your-key-here
WINKY_LLM_MODEL=anthropic/claude-3.5-sonnet
WINKY_LLM_BASE_URL=https://openrouter.ai/api/v1
```

### Custom Chrome Browser

```bash
WINKY_BROWSER_EXECUTABLE_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe
```

### Headless Mode

```bash
WINKY_BROWSER_HEADLESS=true
```

---

## Security Notes

- ⚠️ **Never commit `.env` file to git** - it contains sensitive API keys
- ✅ `.env` is already in `.gitignore`
- ✅ Use `.env.example` as a template (safe to commit)
- ✅ Share `.env.example` with team members, not `.env`

---

## Troubleshooting

### "LLM API key is required" error

- Make sure you have a `.env` file in the project root
- Verify `OPENAI_API_KEY` or `OPENROUTER_API_KEY` is set
- Check for typos in variable names

### Environment variables not loading

- Ensure `.env` file is in the project root (same directory as `package.json`)
- Restart the application after editing `.env`
- Check file encoding (should be UTF-8)
