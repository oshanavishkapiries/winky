/**
 * HumanBehavior - Utilities for human-like browser interactions
 * Helps avoid bot detection by adding realistic delays and patterns
 */
export class HumanBehavior {
  /**
   * Random delay between min and max milliseconds
   */
  async randomDelay(min: number = 100, max: number = 500): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Type text with human-like delays between characters
   */
  async humanType(
    page: any,
    selector: string,
    text: string,
    minDelay: number = 50,
    maxDelay: number = 150,
  ): Promise<void> {
    const element = page.locator(selector);
    await element.click(); // Focus the element

    for (const char of text) {
      await element.pressSequentially(char, {
        delay: Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay,
      });
    }
  }

  /**
   * Generate random mouse movement coordinates
   */
  getRandomOffset(max: number = 5): { x: number; y: number } {
    return {
      x: Math.floor(Math.random() * max * 2) - max,
      y: Math.floor(Math.random() * max * 2) - max,
    };
  }

  /**
   * Random scroll amount
   */
  getRandomScrollAmount(min: number = 100, max: number = 300): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Simulate human-like mouse movement before click
   */
  async humanClick(
    page: any,
    selector: string,
    options?: { button?: "left" | "right" | "middle"; clickCount?: number },
  ): Promise<void> {
    const element = page.locator(selector);

    // Small random delay before click
    await this.randomDelay(100, 300);

    // Click with optional offset for more natural behavior
    const offset = this.getRandomOffset(3);
    await element.click({
      ...options,
      position: offset,
    });
  }

  /**
   * Scroll page with human-like pattern
   */
  async humanScroll(
    page: any,
    direction: "down" | "up" = "down",
    amount?: number,
  ): Promise<void> {
    const scrollAmount =
      amount ||
      this.getRandomScrollAmount(100, 300) * (direction === "up" ? -1 : 1);

    await page.evaluate((pixels: number) => {
      (globalThis as any).window.scrollBy({
        top: pixels,
        behavior: "smooth",
      });
    }, scrollAmount);

    // Wait for scroll to complete
    await this.randomDelay(200, 500);
  }

  /**
   * Random pause to simulate reading/thinking
   */
  async thinkingPause(min: number = 500, max: number = 1500): Promise<void> {
    await this.randomDelay(min, max);
  }
}

// Export singleton instance
export const humanBehavior = new HumanBehavior();
