import express from "express";
import fs from "node:fs";
import path from "node:path";
import { log } from "./logger";
import { config } from "../config";

const app = express();
app.use(express.json());

// Expose public static file access to the scraped outputs natively
app.use(
  "/public/downloads",
  express.static(path.resolve(process.cwd(), config.downloadsDir)),
);
app.use(
  "/public/screenshots",
  express.static(path.resolve(process.cwd(), config.screenshotsDir)),
);

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
// Output Directory File Manager (CRUD)
// ----------------------------------------------------------------------------

const baseOutputDir = path.resolve(process.cwd(), "output");

// Helper: Ensure requested sub-paths do not escape the /output folder (Path Traversal Protection)
function getSafePath(reqPath: string): string | null {
  const target = path.join(baseOutputDir, reqPath);
  if (!target.startsWith(baseOutputDir)) return null;
  return target;
}

// Helper: Recursively map file tree
function getFilesRecursively(dir: string, fileList: any[] = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === ".gitkeep") continue; // Hide placeholder files
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getFilesRecursively(fullPath, fileList);
    } else {
      const relativePath = path
        .relative(baseOutputDir, fullPath)
        .replace(/\\/g, "/");
      fileList.push({
        path: relativePath,
        size: stat.size,
        modifiedAt: stat.mtime,
      });
    }
  }
  return fileList;
}

// READ: Get all files within the output directory
app.get("/api/output", (req, res) => {
  try {
    const files = getFilesRecursively(baseOutputDir);
    res.json({ success: true, files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// READ: Force Download a specific file
app.get(/^\/api\/output\/download\/(.*)$/, (req, res) => {
  const filePath = String((req.params as any)[0]);
  const targetPath = getSafePath(filePath);

  if (!targetPath || !fs.existsSync(targetPath)) {
    return res
      .status(404)
      .json({ success: false, error: "File not found or invalid path." });
  }

  res.download(targetPath);
});

// CREATE / UPDATE: Upload a file into a specific subfolder inside output
import uploadFactory from "multer";
const upload = uploadFactory({ dest: "tmp_uploads/" }); // Temp staging

app.post(
  /^\/api\/output\/upload\/(.*)$/,
  upload.single("file"),
  (req: any, res: any) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file provided. Use form-data 'file' field.",
      });
    }

    const targetSubPath = String((req.params as any)[0]);
    const targetPath = getSafePath(targetSubPath);

    if (!targetPath) {
      fs.unlinkSync(req.file.path); // Cleanup temp file
      return res
        .status(400)
        .json({ success: false, error: "Invalid upload path." });
    }

    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Move from temp staging to final destination securely
      fs.renameSync(req.file.path, targetPath);
      res.json({
        success: true,
        message: `File successfully saved to ${targetSubPath}`,
      });
    } catch (err: any) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

// DELETE: Remove a specific file
app.delete(/^\/api\/output\/(.*)$/, (req, res) => {
  const filePath = String((req.params as any)[0]);
  const targetPath = getSafePath(filePath);

  if (!targetPath || !fs.existsSync(targetPath)) {
    return res
      .status(404)
      .json({ success: false, error: "File not found or invalid path." });
  }

  try {
    fs.unlinkSync(targetPath);
    res.json({ success: true, message: `Successfully deleted ${filePath}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
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
