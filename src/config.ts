export const config = {
  // --- Core Application Defaults ---
  headless: false,
  slowMo: 0,

  // --- Global Directories & State ---
  downloadsDir: "./output/downloads",
  screenshotsDir: "./output/screenshots",
  profileDir: "./profiles/default",
  storageStatePath: "./src/storage/state.json",

  // --- Server / API Details ---
  serverPort: 3000,

  // --- Database Connector ---
  // The PostgreSQL URL used across modules requiring DB tracking
  databaseUrl:
    "postgresql://neondb_owner:npg_UtTfQva4jdY9@ep-empty-pond-ai7rsale-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
};
