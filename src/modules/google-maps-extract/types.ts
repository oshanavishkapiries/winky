export interface SalonData {
  hash_id: string;
  name: string;
  url: string;
  ratings: string | null;
  address: string | null;
  mobile_number: string | null;
  website_link: string | null;
  search_tags: string[];
  reviews: string[];
  accessibility: string[];
  amenities: string[];
  planning: string[];
  payments: string[];
}
