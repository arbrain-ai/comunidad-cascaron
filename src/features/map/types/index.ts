// Map feature types

export interface MemberLocation {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  last_seen: string | null;
  location_city: string | null;
  location_country: string | null;
  location_lat: number | null;
  location_lng: number | null;
}

export interface LocationInput {
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export interface LocationSearchResult {
  display_name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}
