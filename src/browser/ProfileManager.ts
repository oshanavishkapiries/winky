import { resolve } from "node:path";
import { mkdirSync, readdirSync, existsSync } from "node:fs";
import { getLogger } from "../logger/Logger.js";

/**
 * ProfileManager - Manages browser profiles
 * Creates and manages persistent browser profile directories
 */
export class ProfileManager {
  private profilesDir: string;
  private logger = getLogger();

  constructor(profilesDir: string = "data/browser/profiles") {
    this.profilesDir = resolve(process.cwd(), profilesDir);
    this.ensureProfilesDirectory();
  }

  /**
   * Ensure the profiles directory exists
   */
  private ensureProfilesDirectory(): void {
    mkdirSync(this.profilesDir, { recursive: true });
    this.logger.browser("info", "Profiles directory ready", {
      path: this.profilesDir,
    });
  }

  /**
   * Get the absolute path for a profile
   */
  getProfilePath(profileName: string): string {
    return resolve(this.profilesDir, profileName);
  }

  /**
   * Create a new profile directory
   */
  createProfile(profileName: string): string {
    const profilePath = this.getProfilePath(profileName);

    if (existsSync(profilePath)) {
      this.logger.browser("info", "Profile already exists", { profileName });
      return profilePath;
    }

    mkdirSync(profilePath, { recursive: true });
    this.logger.browser("info", "Created new profile", {
      profileName,
      path: profilePath,
    });
    return profilePath;
  }

  /**
   * List all available profiles
   */
  listProfiles(): string[] {
    if (!existsSync(this.profilesDir)) {
      return [];
    }

    const profiles = readdirSync(this.profilesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    this.logger.browser("info", "Listed profiles", { count: profiles.length });
    return profiles;
  }

  /**
   * Check if a profile exists
   */
  profileExists(profileName: string): boolean {
    return existsSync(this.getProfilePath(profileName));
  }
}
