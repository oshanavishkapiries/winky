import type { Page, Locator } from "playwright";

/**
 * Smart element locator that tries multiple strategies
 * Prioritizes accessible name matching (what browser_snapshot returns)
 */
export async function smartLocate(page: Page, ref: string): Promise<Locator> {
  // Strategy 1: Try as accessible name with common roles
  // This matches what browser_snapshot returns
  const commonRoles = [
    "button",
    "link",
    "textbox",
    "searchbox",
    "combobox",
    "input",
    "heading",
    "tab",
    "menuitem",
  ];

  for (const role of commonRoles) {
    try {
      const locator = page.getByRole(role as any, { name: ref });
      // Check if element exists (with short timeout)
      const count = await locator.count();
      if (count > 0) {
        return locator.first();
      }
    } catch {
      // Role doesn't match, continue
    }
  }

  // Strategy 2: Try getByLabel (for form inputs)
  try {
    const locator = page.getByLabel(ref);
    const count = await locator.count();
    if (count > 0) {
      return locator.first();
    }
  } catch {
    // Not a label, continue
  }

  // Strategy 3: Try getByPlaceholder
  try {
    const locator = page.getByPlaceholder(ref);
    const count = await locator.count();
    if (count > 0) {
      return locator.first();
    }
  } catch {
    // Not a placeholder, continue
  }

  // Strategy 4: Try getByText (for exact text match)
  try {
    const locator = page.getByText(ref, { exact: true });
    const count = await locator.count();
    if (count > 0) {
      return locator.first();
    }
  } catch {
    // Not exact text, continue
  }

  // Strategy 5: Fall back to CSS selector (for advanced users)
  // This allows passing CSS selectors like 'textarea[name="q"]'
  return page.locator(ref);
}
