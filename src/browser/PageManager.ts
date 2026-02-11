import type { Page, BrowserContext } from "playwright-core";
import { getLogger } from "../logger/Logger.js";
import { BrowserError } from "../utils/errors.js";

/**
 * PageManager - Manages active pages and tabs
 * Tracks the current page and provides tab management
 */
export class PageManager {
  private context: BrowserContext;
  private currentPage: Page | null = null;
  private logger = getLogger();

  constructor(context: BrowserContext) {
    this.context = context;
  }

  /**
   * Get or create the current active page
   */
  async getCurrentPage(): Promise<Page> {
    // If we have a current page and it's not closed, return it
    if (this.currentPage && !this.currentPage.isClosed()) {
      return this.currentPage;
    }

    // Get existing pages from context
    const pages = this.context.pages();

    if (pages.length > 0) {
      this.currentPage = pages[0];
      this.logger.browser("info", "Using existing page");
      return this.currentPage;
    }

    // Create a new page
    this.currentPage = await this.context.newPage();
    this.logger.browser("info", "Created new page");
    return this.currentPage;
  }

  /**
   * Create a new tab
   */
  async createTab(): Promise<Page> {
    const newPage = await this.context.newPage();
    this.currentPage = newPage;
    this.logger.browser("info", "Created new tab");
    return newPage;
  }

  /**
   * List all open tabs
   */
  listTabs(): Page[] {
    return this.context.pages();
  }

  /**
   * Switch to a specific tab by index
   */
  async switchToTab(index: number): Promise<Page> {
    const pages = this.context.pages();

    if (index < 0 || index >= pages.length) {
      throw new BrowserError(
        `Invalid tab index: ${index}. Available tabs: 0-${pages.length - 1}`,
      );
    }

    this.currentPage = pages[index];
    this.logger.browser("info", "Switched to tab", { index });
    return this.currentPage;
  }

  /**
   * Close a specific tab by index
   */
  async closeTab(index?: number): Promise<void> {
    const pages = this.context.pages();

    if (index === undefined) {
      // Close current page
      if (this.currentPage && !this.currentPage.isClosed()) {
        await this.currentPage.close();
        this.logger.browser("info", "Closed current tab");
        this.currentPage = null;
      }
      return;
    }

    if (index < 0 || index >= pages.length) {
      throw new BrowserError(`Invalid tab index: ${index}`);
    }

    await pages[index].close();
    this.logger.browser("info", "Closed tab", { index });

    // Update current page if we closed it
    if (this.currentPage === pages[index]) {
      this.currentPage = null;
    }
  }

  /**
   * Get tab count
   */
  getTabCount(): number {
    return this.context.pages().length;
  }
}
