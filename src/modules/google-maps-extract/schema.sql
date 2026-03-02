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
