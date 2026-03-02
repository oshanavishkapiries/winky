# Winky MCP Connection Guide

Winky features a baked-in **Model Context Protocol (MCP)** server that allows AI agents (like Claude Desktop, Cursor, or Windsurf) to securely take control of your authenticated Winky browser profile.

This allows the AI to literally "see" through your logged-in sessions, extract HTML, test DOM selectors, and write precise Winky Scraping modules for you automatically.

Here is how you connect various tools to the Winky MCP Server.

---

## 🟢 Option 1: Claude Desktop (Recommended)

Claude Desktop is the easiest way to tap into the Winky MCP to have Claude write scrapers for you.

1. Open your Claude Desktop configuration file:
   - **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
2. Add Winky to your `mcpServers` object:

```json
{
  "mcpServers": {
    "winky-playwright": {
      "command": "npx",
      "args": [
        "ts-node",
        "C:/Users/Oshan/Desktop/d1/winky/src/core/mcp-server.ts"
      ]
    }
  }
}
```

_(Make sure to update the absolute path to your `winky/src/core/mcp-server.ts` file depending on what PC you are on!)_

3. **Restart Claude Desktop.**
4. You will now see a little "Hammer" icon in Claude. You can natively ask it:
   > "Use the Winky tools to open Instagram, find the selector for the first post on the feed, and write a new Winky module matching my `ARCHITECTURE.md`."

---

## 🔵 Option 2: Cursor IDE

Cursor can hook into Winky to let you build scraping modules entirely inside your editor's chat window.

1. Open **Cursor Settings** -> **Features** -> **MCP**.
2. Click **+ Add New MCP Server**.
3. Set the following fields:
   - **Name:** `winky-playwright`
   - **Type:** `command`
   - **Command:** `npx ts-node C:/Users/Oshan/Desktop/d1/winky/src/core/mcp-server.ts`
4. Make sure you are using Absolute paths to `mcp-server.ts` in the command.
5. Click **Add**.
6. The tools will now be available in Cursor Chat. You can say:
   > "Use Winky to navigate to this site, get the HTML, then generate the `index.ts` script for me."

---

## 🛠 Troubleshooting Connecting the MCP

**1. "The server failed to launch"**

- Ensure you have run `npm install` inside the `winky` directory to install `@modelcontextprotocol/sdk`.

**2. "AI says it can't find selectors"**

- Sometimes modern SPAs (React/Vue) load slowly. Remind the AI to use `winky_evaluate` to run JavaScript `setTimeout` or `winky_navigate` again if the DOM hasn't rendered.

**3. "Authentication / Login Wall"**

- The MCP uses Winky's global profile. If a site asks the AI to log in, you should manually boot `npm run dev` -> _Run module natively_, log into the target site yourself by hand, and close Winky to save the cookies.
- When you reconnect the AI, it will inherit your logged-in cookies!
