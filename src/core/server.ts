import express from "express";
import fs from "node:fs";
import path from "node:path";
import { log } from "./logger";
import { config } from "../config";

const app = express();
app.use(express.json());

// Load modules dynamically for routing
function getAvailableModules() {
  const modulesPath = path.resolve(__dirname, "../modules");
  if (!fs.existsSync(modulesPath)) return [];

  const directories = fs
    .readdirSync(modulesPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  const modules: Record<string, any> = {};

  for (const dirName of directories) {
    const moduleIndexPath = path.join(modulesPath, dirName, "index.ts");
    if (fs.existsSync(moduleIndexPath)) {
      try {
        const mod = require(moduleIndexPath);
        if (mod.moduleConfig && mod.run) {
          modules[mod.moduleConfig.name] = mod;
        }
      } catch (e) {
        log.warn(`[API] Failed to parse module in ${dirName}: ${e}`);
      }
    }
  }

  return modules;
}

// ----------------------------------------------------------------------------
// API Endpoints
// ----------------------------------------------------------------------------

// List all registered encapsulated modules
app.get("/api/modules", (req, res) => {
  const modules = getAvailableModules();
  const summary = Object.keys(modules).map((name) => {
    const mod = (modules as Record<string, any>)[name];
    return {
      name: mod.moduleConfig.name,
      description: `Automated scraping module targeting ${name}`,
    };
  });
  res.json({ success: true, modules: summary });
});

// Trigger a specific module's execution payload
app.post("/api/modules/:name/start", (req, res) => {
  const moduleName = req.params.name as string;
  const modules = getAvailableModules();

  const targetModule = (modules as Record<string, any>)[moduleName];

  if (!targetModule) {
    return res
      .status(404)
      .json({ success: false, error: `Module '${moduleName}' not found.` });
  }

  if (targetModule.isRunning?.()) {
    return res.status(400).json({
      success: false,
      error: `Module '${moduleName}' is already actively running.`,
    });
  }

  log.info(`[API] Triggering manual execution of module: ${moduleName}`);

  // Fire and forget mechanism
  targetModule
    .run()
    .catch((e: Error) =>
      log.error(`[API] Background failure in ${moduleName}: ${e}`),
    );

  res.json({
    success: true,
    message: `Module '${moduleName}' background execution started.`,
  });
});

// ----------------------------------------------------------------------------
// Bootstrapper
// ----------------------------------------------------------------------------

export function startApiServer() {
  app.listen(config.serverPort, () => {
    log.info(`====================================`);
    log.info(`Winky API Server Online on Port ${config.serverPort}`);
    log.info(`====================================`);
  });
}
