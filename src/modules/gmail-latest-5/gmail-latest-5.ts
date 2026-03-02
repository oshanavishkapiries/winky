import { type Locator, type Page } from "playwright";

export type GmailListItem = {
  from: string | null;
  fromEmail: string | null;
  subject: string | null;
  snippet: string | null;
  timeTitle: string | null;
};

function cleanText(s: string | null | undefined) {
  const v = (s ?? "").replace(/\s+/g, " ").trim();
  return v.length ? v : null;
}

async function firstAttr(
  locators: Locator[],
  attr: string,
) {
  for (const l of locators) {
    try {
      if ((await l.count()) > 0) {
        const v = await l.first().getAttribute(attr);
        if (v) return v;
      }
    } catch {
      // ignore and continue
    }
  }
  return null;
}

async function firstText(locators: Locator[]) {
  for (const l of locators) {
    try {
      if ((await l.count()) > 0) {
        const v = await l.first().innerText();
        const cleaned = cleanText(v);
        if (cleaned) return cleaned;
      }
    } catch {
      // ignore and continue
    }
  }
  return null;
}

export async function extractLatestGmails(page: Page, limit = 5) {
  await page.goto("https://mail.google.com/mail/u/0/#inbox", {
    waitUntil: "domcontentloaded",
  });

  const rows = page.locator("tr.zA");
  const inboxVisible = await rows
    .first()
    .isVisible({ timeout: 60_000 })
    .catch(() => false);

  if (!inboxVisible) {
    const url = page.url();
    const hint = url.includes("accounts.google.com")
      ? "Not logged in to Google in the shared profile."
      : "Inbox rows not found. Gmail UI may have changed.";
    throw new Error(`Failed to detect Gmail inbox. ${hint} (url=${url})`);
  }

  const count = await rows.count();
  const take = Math.min(limit, count);
  const items: GmailListItem[] = [];

  for (let i = 0; i < take; i++) {
    const row = rows.nth(i);

    const sender = row.locator(
      ".yX.xY span[email], .yX span[email], span[email]",
    );
    const subject = row.locator("span.bog, .bog");
    const snippet = row.locator("span.y2, .y2");
    const time = row.locator(
      "td.xW span[title], span[title][aria-label], td.xW span",
    );

    const fromEmail = await firstAttr([sender], "email");
    const fromNameAttr = await firstAttr([sender], "name");
    const fromText = await firstText([sender]);
    const timeTitle = await firstAttr([time], "title");

    items.push({
      from: cleanText(fromNameAttr) ?? fromText,
      fromEmail: cleanText(fromEmail),
      subject: await firstText([subject]),
      snippet: await firstText([snippet]),
      timeTitle: cleanText(timeTitle),
    });
  }

  return items;
}
