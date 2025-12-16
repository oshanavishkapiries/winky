# 🤖 Browser Automation Agent - CLI Commands

Complete reference for all available commands.

---

## 🚀 Agent Commands

Run the AI-powered browser automation agent.

### Basic Usage

```bash
# Run agent with a goal
npm run agent "go to google and search for weather"

# Start from a specific URL
npm run agent https://google.com "search for latest news"

# Multi-step tasks
npm run agent "go to linkedin.com and login with email test@email.com password mypass123 then go to jobs"
```

### Options

```bash
# Headless mode (no browser window)
npm run agent "go to google" -- --headless

# Choose LLM provider
npm run agent "search something" -- --llm gemini
npm run agent "search something" -- --llm openrouter
npm run agent "search something" -- --llm cerebras
npm run agent "search something" -- --llm ollama
```

### Data Extraction

```bash
# Extract data as JSON
npm run agent "go to amazon.sg and search laptops, extract top 5 with name and price"

# Extract as Markdown summary
npm run agent "go to wikipedia.org/wiki/Tokyo and summarize the page"
```

---

## 🐕 WKY Workflow Commands

Execute and manage `.wky` (Winky) workflow files.

### Execute Workflow

```bash
# Run a .wky workflow file
npm run wky data/workflows/login-flow.wky

# Run headless
npm run wky data/workflows/search.wky --headless

# Custom delay between actions (ms)
npm run wky data/workflows/checkout.wky --delay 2000
```

### Convert Files

```bash
# JSON to WKY (auto-detect)
npm run wky:convert data/logs/log_20251216.json

# WKY to JSON (auto-detect)
npm run wky:convert data/workflows/my-flow.wky

# Specify output path
npm run wky:convert log.json --output data/workflows/my-flow.wky

# Explicit direction
npm run wky:convert file.json --to-wky
npm run wky:convert file.wky --to-json
```

---

## 🔧 Utility Commands

### HTML Processing

```bash
# Simplify HTML file for LLM processing
npm run simplify data/html-pages/sample.html

# Extract HTML from URL
npm run extract https://example.com
```

### Token Counting

```bash
# Count tokens in a file
npm run tokens data/simplified-html/sample.html

# Count and save report
npm run tokens:save data/simplified-html/sample.html
```

### Data Management

```bash
# Clean all generated data files
npm run clean

# Test cookie loading
npm run test:cookies
```

---

## 📁 File Locations

| Type            | Location                |
| --------------- | ----------------------- |
| Action Logs     | `data/logs/`            |
| WKY Workflows   | `data/workflows/`       |
| Output Data     | `data/output/`          |
| Cookies         | `data/cookies/`         |
| Browser Profile | `data/browser-profile/` |
| Simplified HTML | `data/simplified-html/` |
| Element Maps    | `data/element-map/`     |

---

## 🔑 Environment Variables

Configure in `.env` file:

```env
# LLM Provider (gemini, openrouter, cerebras, ollama)
DEFAULT_LLM=openrouter

# API Keys
GEMINI_API_KEY=your-key
OPENROUTER_API_KEY=your-key
CEREBRAS_API_KEY=your-key

# Browser
CHROME_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe
HEADLESS=false

# Agent Settings
AGENT_MAX_STEPS=50
AGENT_WAIT_BETWEEN_ACTIONS=1000
```

---

## 📊 Log Viewer

Open `src/tools/log-viewer.html` in browser to visually analyze action logs.

Features:

- Drag & drop JSON log files
- View simplified HTML at each step
- View element maps
- View LLM prompts and responses
- Accordion-style action cells

---

## 🔌 MCP Server

Connect browser automation to Claude Desktop, VS Code, or any MCP client.

### Start MCP Server

```bash
npm run start:mcp
```

### Agent Mode (Your LLM drives)

```
# Claude Desktop or MCP client
Use tool: browser_run_goal
  goal: "Go to google and search for weather"

# Your configured LLM (Gemini/OpenRouter) makes all decisions
```

### Direct Mode (You drive step-by-step)

```
# MCP client (Claude) drives each step
1. direct_open     → Open browser at URL, get elements
2. direct_get_state → View page HTML and elements
3. direct_click    → Click element by UUID
4. direct_type     → Type into input
5. direct_scroll   → Scroll page
6. direct_back     → Go back
7. direct_close    → Close browser
```

**Direct Mode Tools:**
| Tool | Description |
|------|-------------|
| `direct_open` | Open browser at URL |
| `direct_get_state` | Get page HTML + elements |
| `direct_click` | Click by element UUID |
| `direct_type` | Type into element |
| `direct_scroll` | Scroll page |
| `direct_goto` | Navigate to URL |
| `direct_back` | Go back in history |
| `direct_screenshot` | Take screenshot |
| `direct_close` | Close browser |

---

## 💡 Examples

### Search & Extract

```bash
npm run agent "go to google, search 'best laptops 2024', extract top 5 results with title and link"
```

### Login Flow

```bash
npm run agent "go to github.com, login with user@email.com and password123, go to repositories"
```

### Save and Replay

```bash
# Run agent (creates log)
npm run agent "go to google and search test"

# Convert log to workflow
npm run wky:convert data/logs/log_XXXXXX.json

# Replay without LLM
npm run wky data/logs/log_XXXXXX.wky
```
