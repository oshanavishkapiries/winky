import { type Page } from "playwright";

export interface ListingItem {
  detailUrl: string;
  thumbUrl: string | null;
  keywords: string[] | null;
}

export interface WallpaperDetail {
  title: string | null;
  category: string | null;
  tags: string[] | null;
  downloadUrl: string | null;
}

function normalizeTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const v = t.trim();
    if (!v) continue;
    out.push(v);
  }
  return Array.from(new Set(out));
}

export async function extractListingItems(page: Page): Promise<ListingItem[]> {
  await page.waitForSelector("#pics-list .wallpapers__item a.wallpapers__canvas_image", {
    timeout: 30_000,
  });

  const items = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLParagraphElement>("#pics-list p.wallpapers__item"),
    );

    return nodes
      .map((p) => {
        const a = p.querySelector<HTMLAnchorElement>("a.wallpapers__canvas_image");
        const img = p.querySelector<HTMLImageElement>("img[itemprop='thumbnail']");
        const meta = p.querySelector<HTMLMetaElement>("meta[itemprop='keywords']");

        const href = a?.href ?? null;
        if (!href) return null;

        const thumbUrl = img?.src ?? null;
        const keywordsRaw = meta?.content ?? null;
        const keywords = keywordsRaw
          ? keywordsRaw
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean)
          : null;

        return { detailUrl: href, thumbUrl, keywords };
      })
      .filter((x): x is { detailUrl: string; thumbUrl: string | null; keywords: string[] | null } => Boolean(x));
  });

  return items;
}

export async function extractWallpaperDetail(page: Page): Promise<WallpaperDetail | null> {
  await page.waitForSelector("#content", { timeout: 30_000 });

  const data = await page.evaluate(() => {
    const title = document.querySelector<HTMLHeadingElement>(".inner h1")?.textContent?.trim() ?? null;

    const category =
      document.querySelector<HTMLAnchorElement>(".pic-right p.tags a[href^='/']")?.textContent?.trim() ?? null;

    const tagEls = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(".pic-right p.tags a[href^='https://4kwallpapers.com/']"),
    );
    const tags = tagEls.map((a) => a.textContent?.trim() ?? "").filter(Boolean);

    const dlLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(".pic-right .res-ttl a"),
    );
    const original = dlLinks.find((a) => (a.textContent ?? "").toLowerCase().includes("original"));
    const anyDl = original ?? dlLinks[0] ?? null;

    const downloadUrl = anyDl ? anyDl.href : null;

    return { title, category, tags, downloadUrl };
  });

  if (!data) return null;

  return {
    title: data.title,
    category: data.category,
    tags: data.tags ? normalizeTags(data.tags) : null,
    downloadUrl: data.downloadUrl,
  };
}
