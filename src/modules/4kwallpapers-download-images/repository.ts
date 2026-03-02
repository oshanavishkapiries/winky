import { db } from "../../core/db";
import { log } from "../../core/logger";

export interface UpsertWallpaperInput {
  hash_id: string;
  wallpaper_id: number | null;
  page_url: string;
  title: string | null;
  category: string | null;
  tags: string[] | null;
  thumb_url: string | null;
  download_url: string | null;
}

export interface DownloadMeta {
  file_path: string;
  file_sha256: string;
  file_bytes: number;
}

export interface ProgressRow {
  job_key: string;
  next_page: number;
  updated_at: string;
}

export async function initTables(): Promise<void> {
  const q1 = `
    CREATE TABLE IF NOT EXISTS wallpapers_4kwallpapers (
      hash_id VARCHAR(64) PRIMARY KEY,
      wallpaper_id BIGINT,
      page_url TEXT NOT NULL,
      title TEXT,
      category TEXT,
      tags JSONB,
      thumb_url TEXT,
      download_url TEXT,
      downloaded_at TIMESTAMP WITH TIME ZONE,
      file_path TEXT,
      file_sha256 VARCHAR(64),
      file_bytes BIGINT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const q2 = `
    CREATE TABLE IF NOT EXISTS wallpapers_4kwallpapers_progress (
      job_key TEXT PRIMARY KEY,
      next_page INT NOT NULL DEFAULT 1,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const q3 = `
    CREATE TABLE IF NOT EXISTS wallpapers_4kwallpapers_runs (
      run_id BIGSERIAL PRIMARY KEY,
      job_key TEXT NOT NULL,
      start_page INT NOT NULL,
      max_pages INT NOT NULL,
      end_page INT,
      status TEXT NOT NULL,
      stats JSONB,
      error_message TEXT,
      started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMP WITH TIME ZONE
    );
  `;

  try {
    await db.query(q1);
    await db.query(q2);
    await db.query(q3);
    log.info("4KWallpapers: tables initialized.");
  } catch (e) {
    log.error(`4KWallpapers: failed to init tables: ${e}`);
  }
}

export async function wallpaperExists(hash_id: string): Promise<boolean> {
  const res = await db.query("SELECT 1 FROM wallpapers_4kwallpapers WHERE hash_id = $1 LIMIT 1", [hash_id]);
  return (res.rowCount ?? 0) > 0;
}

export async function upsertWallpaper(input: UpsertWallpaperInput): Promise<void> {
  const q = `
    INSERT INTO wallpapers_4kwallpapers (
      hash_id, wallpaper_id, page_url, title, category, tags, thumb_url, download_url
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8
    )
    ON CONFLICT (hash_id) DO UPDATE SET
      wallpaper_id = COALESCE(EXCLUDED.wallpaper_id, wallpapers_4kwallpapers.wallpaper_id),
      page_url = EXCLUDED.page_url,
      title = COALESCE(EXCLUDED.title, wallpapers_4kwallpapers.title),
      category = COALESCE(EXCLUDED.category, wallpapers_4kwallpapers.category),
      tags = COALESCE(EXCLUDED.tags, wallpapers_4kwallpapers.tags),
      thumb_url = COALESCE(EXCLUDED.thumb_url, wallpapers_4kwallpapers.thumb_url),
      download_url = COALESCE(EXCLUDED.download_url, wallpapers_4kwallpapers.download_url);
  `;

  await db.query(q, [
    input.hash_id,
    input.wallpaper_id,
    input.page_url,
    input.title,
    input.category,
    input.tags ? JSON.stringify(input.tags) : null,
    input.thumb_url,
    input.download_url,
  ]);
}

export async function markDownloaded(hash_id: string, meta: DownloadMeta): Promise<void> {
  const q = `
    UPDATE wallpapers_4kwallpapers
    SET downloaded_at = CURRENT_TIMESTAMP,
        file_path = $2,
        file_sha256 = $3,
        file_bytes = $4
    WHERE hash_id = $1;
  `;
  await db.query(q, [hash_id, meta.file_path, meta.file_sha256, meta.file_bytes]);
}

export async function getProgress(job_key: string): Promise<ProgressRow | null> {
  const res = await db.query<ProgressRow>(
    "SELECT job_key, next_page, updated_at::text as updated_at FROM wallpapers_4kwallpapers_progress WHERE job_key = $1 LIMIT 1",
    [job_key],
  );
  return res.rows[0] ?? null;
}

export async function setProgress(
  job_key: string,
  input: { next_page: number },
): Promise<void> {
  const q = `
    INSERT INTO wallpapers_4kwallpapers_progress (job_key, next_page, updated_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (job_key) DO UPDATE SET
      next_page = EXCLUDED.next_page,
      updated_at = CURRENT_TIMESTAMP;
  `;
  await db.query(q, [job_key, input.next_page]);
}

export async function createRun(input: {
  job_key: string;
  start_page: number;
  max_pages: number;
}): Promise<number> {
  const q = `
    INSERT INTO wallpapers_4kwallpapers_runs (job_key, start_page, max_pages, status)
    VALUES ($1, $2, $3, 'running')
    RETURNING run_id;
  `;
  const res = await db.query<{ run_id: string }>(q, [
    input.job_key,
    input.start_page,
    input.max_pages,
  ]);
  const runId = Number(res.rows[0]?.run_id);
  return Number.isFinite(runId) ? runId : 0;
}

export async function finishRun(
  run_id: number,
  input: {
    status: "success" | "error";
    end_page: number;
    stats: any;
    error_message?: string;
  },
): Promise<void> {
  const q = `
    UPDATE wallpapers_4kwallpapers_runs
    SET status = $2,
        end_page = $3,
        stats = $4,
        error_message = $5,
        finished_at = CURRENT_TIMESTAMP
    WHERE run_id = $1;
  `;
  await db.query(q, [
    run_id,
    input.status,
    input.end_page,
    JSON.stringify(input.stats ?? {}),
    input.error_message ?? null,
  ]);
}
