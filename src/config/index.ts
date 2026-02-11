import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { WinkyConfigSchema, type WinkyConfig } from "./schema.js";
import { defaultConfig } from "./defaults.js";

/**
 * Loads and validates the Winky configuration
 * Reads from winky.config.ts in the project root
 */
export async function loadConfig(): Promise<WinkyConfig> {
  const configPath = resolve(process.cwd(), "winky.config.ts");

  try {
    // Dynamic import of the config file
    const configModule = await import(pathToFileURL(configPath).href);
    const userConfig = configModule.default || configModule.config;

    // Merge with defaults
    const mergedConfig = {
      ...defaultConfig,
      ...userConfig,
      browser: {
        ...defaultConfig.browser,
        ...userConfig.browser,
      },
      logging: {
        ...defaultConfig.logging,
        ...userConfig.logging,
      },
      acp: {
        ...defaultConfig.acp,
        ...userConfig.acp,
      },
    };

    // Validate with Zod
    const validatedConfig = WinkyConfigSchema.parse(mergedConfig);
    return validatedConfig;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ERR_MODULE_NOT_FOUND"
    ) {
      throw new Error(
        `Configuration file not found at ${configPath}. Please create winky.config.ts in the project root.`,
      );
    }
    throw error;
  }
}
