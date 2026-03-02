import { db } from "../../core/db";
import { log } from "../../core/logger";
import { type SalonData } from "./types";
import crypto from "crypto";

/**
 * Generates a consistent hash for a salon using its name and url.
 */
export function generateSalonHash(name: string, url: string): string {
  return crypto.createHash("sha256").update(`${name}||${url}`).digest("hex");
}

/**
 * Checks if a salon already exists in the database.
 */
export async function salonExists(hash_id: string): Promise<boolean> {
  try {
    const res = await db.query(
      "SELECT 1 FROM salons WHERE hash_id = $1 LIMIT 1",
      [hash_id],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    log.error(`Error checking if salon exists: ${error}`);
    return false;
  }
}

/**
 * Creates the necessary table if it doesn't already exist.
 * This runs automatically upon loading the module or can be called explicitly.
 */
export async function initTable(): Promise<void> {
  const query = `
    CREATE TABLE IF NOT EXISTS salons (
      hash_id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      ratings VARCHAR(50),
      address TEXT,
      mobile_number VARCHAR(50),
      website_link TEXT,
      search_tags JSONB,
      reviews JSONB,
      accessibility JSONB,
      amenities JSONB,
      planning JSONB,
      payments JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await db.query(query);
    log.info("Google Maps Extract: Salons table initialized.");
  } catch (error) {
    log.error(`Failed to initialize salons table: ${error}`);
  }
}

/**
 * Inserts a new salon record into the database.
 */
export async function saveSalon(data: SalonData): Promise<void> {
  const query = `
    INSERT INTO salons (
      hash_id, name, url, ratings, address, mobile_number, website_link,
      search_tags, reviews, accessibility, amenities, planning, payments
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    ) ON CONFLICT (hash_id) DO NOTHING;
  `;

  const values = [
    data.hash_id,
    data.name,
    data.url,
    data.ratings,
    data.address,
    data.mobile_number,
    data.website_link,
    JSON.stringify(data.search_tags),
    JSON.stringify(data.reviews),
    JSON.stringify(data.accessibility),
    JSON.stringify(data.amenities),
    JSON.stringify(data.planning),
    JSON.stringify(data.payments),
  ];

  try {
    await db.query(query, values);
    log.info(`Saved salon: ${data.name}`);
  } catch (error) {
    log.error(`Failed to save salon ${data.name}: ${error}`);
  }
}
