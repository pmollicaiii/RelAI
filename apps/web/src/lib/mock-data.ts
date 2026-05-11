/**
 * Mock data for the UI scaffold — used so pages render before Neon is
 * provisioned + before real data lands.
 *
 * Will be replaced by Drizzle queries from @relai/db once DATABASE_URL is
 * configured. Keeping the mock data SHAPE the same as the DB row shape
 * makes the swap mechanical.
 */

export interface MockFolder {
  id: string;
  displayName: string;
  shorthand: string; // "Lower Merion · 4bd+ · $750k-$850k"
  status: "active" | "paused" | "closed";
  stats: {
    searches: number;
    packetsSent: number;
    lastActiveLabel: string;
  };
}

export interface MockListingCard {
  id: string;
  mlsNumber: string;
  address: string;
  city: string;
  state: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  oneLineWhy: string;
  fitScore: number;
  thumbnailUrl: string;
}

export interface MockSoftPrefChip {
  id: string;
  slug: string;
  displayLabel: string;
  category: string;
  weight: number;
  polarity: "positive" | "negative";
  sourceQuote: string;
  confidence: number;
}

export const MOCK_FOLDERS: MockFolder[] = [
  {
    id: "f-hendersons",
    displayName: "The Hendersons",
    shorthand: "Lower Merion · 4bd+ · $750k-$850k",
    status: "active",
    stats: {
      searches: 12,
      packetsSent: 3,
      lastActiveLabel: "last active 2d ago",
    },
  },
  {
    id: "f-sarah-chen",
    displayName: "Sarah Chen",
    shorthand: "Center City · 2-3bd · $400k-$550k",
    status: "active",
    stats: {
      searches: 4,
      packetsSent: 1,
      lastActiveLabel: "last active 5h ago",
    },
  },
  {
    id: "f-kim-park",
    displayName: "Kim & Park",
    shorthand: "Bryn Mawr · 5bd · $1M-$1.3M",
    status: "active",
    stats: {
      searches: 8,
      packetsSent: 2,
      lastActiveLabel: "last active 1d ago",
    },
  },
];

export const MOCK_LISTINGS: MockListingCard[] = [
  {
    id: "l-001",
    mlsNumber: "PABU2118802",
    address: "123 Oak Street",
    city: "Bryn Mawr",
    state: "PA",
    price: 785_000,
    beds: 4,
    baths: 2.5,
    sqft: 2400,
    oneLineWhy: "Matches your office requirement; back den has a separate entrance.",
    fitScore: 0.91,
    thumbnailUrl: "/seed/house-01.jpg",
  },
  {
    id: "l-002",
    mlsNumber: "PABU2118803",
    address: "456 Elm Avenue",
    city: "Bryn Mawr",
    state: "PA",
    price: 820_000,
    beds: 4,
    baths: 3,
    sqft: 2700,
    oneLineWhy: "Mature trees, quiet street, walking to the train.",
    fitScore: 0.87,
    thumbnailUrl: "/seed/house-02.jpg",
  },
  {
    id: "l-003",
    mlsNumber: "PABU2118804",
    address: "789 Maple Lane",
    city: "Wynnewood",
    state: "PA",
    price: 760_000,
    beds: 4,
    baths: 2.5,
    sqft: 2300,
    oneLineWhy: "Updated kitchen with island; below your budget by $90k.",
    fitScore: 0.83,
    thumbnailUrl: "/seed/house-03.jpg",
  },
  {
    id: "l-004",
    mlsNumber: "PABU2118805",
    address: "101 Pine Court",
    city: "Bryn Mawr",
    state: "PA",
    price: 845_000,
    beds: 5,
    baths: 3,
    sqft: 2800,
    oneLineWhy: "Bonus room could be an office; finished basement.",
    fitScore: 0.79,
    thumbnailUrl: "/seed/house-01.jpg",
  },
  {
    id: "l-005",
    mlsNumber: "PABU2118806",
    address: "202 Birch Drive",
    city: "Haverford",
    state: "PA",
    price: 815_000,
    beds: 4,
    baths: 3,
    sqft: 2500,
    oneLineWhy: "Open kitchen-dining flow; fenced backyard.",
    fitScore: 0.76,
    thumbnailUrl: "/seed/house-02.jpg",
  },
];

export const MOCK_CHIPS: MockSoftPrefChip[] = [
  {
    id: "c-1",
    slug: "amenities.home-office-dedicated",
    displayLabel: "dedicated home office",
    category: "amenities",
    weight: 0.9,
    polarity: "positive",
    sourceQuote: "I do all my calls from home so noise kills me",
    confidence: 0.9,
  },
  {
    id: "c-2",
    slug: "layout.open-floor-plan",
    displayLabel: "open floor plan",
    category: "layout",
    weight: 0.85,
    polarity: "positive",
    sourceQuote: "we love how the kitchen and great room flow",
    confidence: 0.85,
  },
  {
    id: "c-3",
    slug: "interior-features.hardwood-floors",
    displayLabel: "hardwood floors",
    category: "interior_features",
    weight: 0.7,
    polarity: "positive",
    sourceQuote: "must be hardwood throughout",
    confidence: 0.8,
  },
  {
    id: "c-4",
    slug: "lifestyle-location.near-good-schools",
    displayLabel: "near good schools",
    category: "lifestyle_location",
    weight: 0.95,
    polarity: "positive",
    sourceQuote: "Lower Merion district is the priority",
    confidence: 0.95,
  },
  {
    id: "c-5",
    slug: "lifestyle-location.suburban-quiet",
    displayLabel: "quiet suburban",
    category: "lifestyle_location",
    weight: 0.8,
    polarity: "positive",
    sourceQuote: "a quiet street, not a thoroughfare",
    confidence: 0.85,
  },
  {
    id: "c-6",
    slug: "layout.dim-cozy",
    displayLabel: "dim cozy",
    category: "layout",
    weight: 0.7,
    polarity: "negative",
    sourceQuote: "natural light is huge for us",
    confidence: 0.75,
  },
  {
    id: "c-7",
    slug: "avoidance-specific.no-busy-road",
    displayLabel: "no busy road",
    category: "avoidance_specific",
    weight: 0.85,
    polarity: "negative",
    sourceQuote: "main roads make me anxious",
    confidence: 0.9,
  },
  {
    id: "c-8",
    slug: "avoidance-specific.no-shared-walls",
    displayLabel: "no shared walls",
    category: "avoidance_specific",
    weight: 0.8,
    polarity: "negative",
    sourceQuote: "detached only — no townhouse",
    confidence: 0.85,
  },
];
