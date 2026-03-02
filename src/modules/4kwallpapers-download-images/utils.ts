import crypto from "node:crypto";

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function safeBasename(name: string): string {
  const cleaned = name
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\.+$/g, "")
    .slice(0, 140);

  return cleaned.length > 0 ? cleaned : "wallpaper";
}
