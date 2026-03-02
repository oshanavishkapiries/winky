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

CREATE TABLE IF NOT EXISTS wallpapers_4kwallpapers_progress (
  job_key TEXT PRIMARY KEY,
  next_page INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
