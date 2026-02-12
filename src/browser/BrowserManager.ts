import { chromium, type Browser, type BrowserContext } from "playwright";
import { getLogger } from "../logger/Logger.js";
import { BrowserError } from "../utils/errors.js";
import type { WinkyConfig } from "../config/schema.js";

/**
 * BrowserManager - Manages browser lifecycle
 * Handles launching, closing, and managing browser instances
 * Follows Single Responsibility Principle
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private config: WinkyConfig["browser"];
  private logger = getLogger();

  constructor(config: WinkyConfig["browser"]) {
    this.config = config;
  }

  /**
   * Launch browser with custom executable path
   */
  async launch(): Promise<void> {
    if (this.browser) {
      this.logger.browser("warn", "Browser already launched");
      return;
    }

    try {
      this.logger.browser("info", "Launching browser", {
        executablePath: this.config.executablePath || "bundled Chromium",
        headless: this.config.headless,
      });

      this.browser = await chromium.launch({
        ...(this.config.executablePath && {
          executablePath: this.config.executablePath,
        }),
        headless: this.config.headless,
      });

      // Create a new context
      this.context = await this.browser.newContext({
        viewport: this.config.viewport,
      });

      this.logger.browser("info", "Browser launched successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.browser("error", "Failed to launch browser", {
        error: message,
      });
      throw new BrowserError(`Failed to launch browser: ${message}`);
    }
  }

  /**
   * Launch browser with persistent context (profile)
   */
  async launchPersistent(userDataDir: string): Promise<void> {
    if (this.browser || this.context) {
      this.logger.browser("warn", "Browser already launched");
      return;
    }

    try {
      this.logger.browser("info", "Launching browser with persistent context", {
        userDataDir,
        executablePath: this.config.executablePath || "bundled Chromium",
      });

      this.context = await chromium.launchPersistentContext(userDataDir, {
        ...(this.config.executablePath && {
          executablePath: this.config.executablePath,
        }),
        headless: this.config.headless,
        viewport: this.config.viewport,
        // Stealth options to avoid bot detection
        args: [
          "--disable-blink-features=AutomationControlled",
          "--disable-dev-shm-usage",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-web-security",
        ],
        // Realistic user agent
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      });

      // Remove webdriver flag and add realistic properties
      // Use globalThis to access browser context globals
      await this.context.addInitScript(() => {
        const win = globalThis as any;
        const nav = win.navigator;

        Object.defineProperty(nav, "webdriver", {
          get: () => undefined,
        });

        win.chrome = {
          runtime: {},
        };

        const originalQuery = nav.permissions.query;
        nav.permissions.query = (parameters: any) =>
          parameters.name === "notifications"
            ? Promise.resolve({
                state: win.Notification.permission,
              })
            : originalQuery(parameters);

        Object.defineProperty(nav, "plugins", {
          get: () => [1, 2, 3, 4, 5],
        });

        Object.defineProperty(nav, "languages", {
          get: () => ["en-US", "en"],
        });
      });

      this.logger.browser("info", "Browser launched with persistent context");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.browser("error", "Failed to launch persistent browser", {
        error: message,
      });
      throw new BrowserError(`Failed to launch persistent browser: ${message}`);
    }
  }

  /**
   * Get the current browser context
   */
  getContext(): BrowserContext {
    if (!this.context) {
      throw new BrowserError(
        "Browser context not available. Call launch() first.",
      );
    }
    return this.context;
  }

  /**
   * Get the browser instance
   */
  getBrowser(): Browser | null {
    return this.browser;
  }

  /**
   * Check if browser is running
   */
  isRunning(): boolean {
    return this.browser !== null || this.context !== null;
  }

  /**
   * Close browser gracefully
   */
  async close(): Promise<void> {
    try {
      if (this.context) {
        this.logger.browser("info", "Closing browser context");
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        this.logger.browser("info", "Closing browser");
        await this.browser.close();
        this.browser = null;
      }

      this.logger.browser("info", "Browser closed successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.browser("error", "Error closing browser", { error: message });
      throw new BrowserError(`Failed to close browser: ${message}`);
    }
  }
}
