import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import { type Page } from "playwright";
import { log } from "../../core/logger";
import {
  createRun,
  finishRun,
  getProgress,
  getWallpaperStatus,
  initTables,
  markDownloaded,
  upsertWallpaper,
  setProgress,
} from "./repository";
import {
  type ListingItem,
  type WallpaperDetail,
  extractListingItems,
  extractWallpaperDetail,
} from "./selectors";
import { safeBasename, sha256Hex } from "./utils";

export interface RunOptions {
  baseUrl: string;
  outputDir: string;
  jobKey?: string;
  maxPagesPerRun?: number;
  navigationTimeoutMs?: number;
  downloadOriginal?: boolean;
}

interface RunStats {
  pagesVisited: number;
  newItems: number;
  skippedExisting: number;
  downloaded: number;
  downloadFailed: number;
}

function resolveListUrl(baseUrl: string, pageNum: number): string {
  if (pageNum <= 1) return baseUrl;
  const u = new URL(baseUrl);
  u.searchParams.set("page", String(pageNum));
  return u.toString();
}

function parseWallpaperIdFromUrl(url: string): number | null {
  const m = url.match(/-(\d+)\.html(?:\?.*)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

async function downloadToFile(
  page: Page,
  url: string,
  filePath: string,
): Promise<{ bytes: number; sha256: string } | null> {
  const res = await page.request.get(url);
  if (!res.ok()) {
    log.warn(`[4kwallpapers] Download failed: ${res.status()} ${url}`);
    return null;
  }

  const buf = await res.body();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buf);
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  return { bytes: buf.length, sha256: sha };
}

export async function run4kWallpapersDownload(page: Page, options: RunOptions) {
  const jobKey = options.jobKey ?? "recent";
  const maxPagesPerRun = options.maxPagesPerRun ?? 5;
  const navigationTimeoutMs = options.navigationTimeoutMs ?? 60_000;
  const downloadOriginal = options.downloadOriginal ?? true;

  await initTables();

  const progress = await getProgress(jobKey);
  const startPage = progress?.next_page ?? 1;

  const runId = await createRun({
    job_key: jobKey,
    start_page: startPage,
    max_pages: maxPagesPerRun,
  });

  const stats: RunStats = {
    pagesVisited: 0,
    newItems: 0,
    skippedExisting: 0,
    downloaded: 0,
    downloadFailed: 0,
  };

  let currentPageNum = startPage;
  let lastSuccessfulPageNum = startPage - 1;

  try {
    for (let i = 0; i < maxPagesPerRun; i++) {
      const listUrl = resolveListUrl(options.baseUrl, currentPageNum);

      log.info(`[4kwallpapers] Visiting list page ${currentPageNum}: ${listUrl}`);
      await page.goto(listUrl, {
        waitUntil: "domcontentloaded",
        timeout: navigationTimeoutMs,
      });

      const items: ListingItem[] = await extractListingItems(page);
      if (items.length === 0) {
        log.warn(`[4kwallpapers] No items found on page=${currentPageNum}. Stopping.`);
        break;
      }

      stats.pagesVisited++;
      lastSuccessfulPageNum = currentPageNum;

      for (const item of items) {
        const pageUrl = item.detailUrl;
        const hashId = sha256Hex(pageUrl);
        const status = await getWallpaperStatus(hashId);
        if (status?.downloaded_at) {
          stats.skippedExisting++;
          continue;
        }

        if (!status) stats.newItems++;

        log.info(`[4kwallpapers] New wallpaper: ${pageUrl}`);
        await page.goto(pageUrl, {
          waitUntil: "domcontentloaded",
          timeout: navigationTimeoutMs,
        });

        const detail: WallpaperDetail | null = await extractWallpaperDetail(page);
        if (!detail?.downloadUrl) {
          log.warn(`[4kwallpapers] Missing download url: ${pageUrl}`);
          await upsertWallpaper({
            hash_id: hashId,
            wallpaper_id: parseWallpaperIdFromUrl(pageUrl),
            page_url: pageUrl,
            title: detail?.title ?? null,
            category: detail?.category ?? null,
            tags: detail?.tags ?? item.keywords ?? null,
            thumb_url: item.thumbUrl ?? null,
            download_url: null,
          });
          continue;
        }

        const dlUrl = detail.downloadUrl;
        const fileBase = safeBasename(
          `${detail.title ?? "wallpaper"}-${parseWallpaperIdFromUrl(pageUrl) ?? hashId.slice(0, 12)}`,
        );
        const ext = path.extname(new URL(dlUrl).pathname) || ".jpg";
        const outPath = path.join(options.outputDir, `${fileBase}${ext}`);

        await upsertWallpaper({
          hash_id: hashId,
          wallpaper_id: parseWallpaperIdFromUrl(pageUrl),
          page_url: pageUrl,
          title: detail.title ?? null,
          category: detail.category ?? null,
          tags: detail.tags ?? item.keywords ?? null,
          thumb_url: item.thumbUrl ?? null,
          download_url: dlUrl,
        });

        if (!downloadOriginal) continue;

        if (status?.download_url && status.download_url !== dlUrl) {
          log.info(`[4kwallpapers] Download url updated for: ${pageUrl}`);
        }

        const downloaded = await downloadToFile(page, dlUrl, outPath);
        if (!downloaded) {
          stats.downloadFailed++;
          continue;
        }

        stats.downloaded++;
        await markDownloaded(hashId, {
          file_path: outPath,
          file_sha256: downloaded.sha256,
          file_bytes: downloaded.bytes,
        });
        log.info(`[4kwallpapers] Downloaded -> ${outPath}`);
      }

      currentPageNum++;
      await setProgress(jobKey, { next_page: currentPageNum });
    }

    await finishRun(runId, {
      status: "success",
      end_page: lastSuccessfulPageNum,
      stats,
    });
  } catch (err) {
    await finishRun(runId, {
      status: "error",
      end_page: lastSuccessfulPageNum,
      stats,
      error_message: String(err),
    });
    throw err;
  }
}
