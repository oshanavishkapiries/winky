import "dotenv/config";

export const config = {
  headless: process.env.HEADLESS === "true",
  slowMo: Number(process.env.SLOW_MO ?? 0),
  profileDir: process.env.PROFILE_DIR ?? "./profiles/default",
  storageStatePath: process.env.STORAGE_STATE ?? "./src/storage/state.json",
  downloadsDir: process.env.DOWNLOADS_DIR ?? "./output/downloads",
  screenshotsDir: process.env.SCREENSHOTS_DIR ?? "./output/screenshots",
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/winky",
  cronSchedule: process.env.CRON_SCHEDULE ?? "0 0 * * *",
  enableScheduler: process.env.ENABLE_SCHEDULER !== "false",
};
