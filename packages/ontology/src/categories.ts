import type { SoftPrefCategory } from "./types.js";

/**
 * Display metadata for soft-pref categories. Used in Smart Control UI
 * (chip groupings on the Search surface) and admin Ontology Inbox.
 */
export interface CategoryMeta {
  id: SoftPrefCategory;
  displayLabel: string;
  description: string;
  /** Order in the Smart Control dashboard (top → bottom). */
  sortOrder: number;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: "interior_features",
    displayLabel: "Interior",
    description: "Kitchen, floors, fireplaces, finishes inside the home",
    sortOrder: 1,
  },
  {
    id: "layout",
    displayLabel: "Layout",
    description: "Floor plan, levels, light, room flow",
    sortOrder: 2,
  },
  {
    id: "interior_style",
    displayLabel: "Style",
    description: "Aesthetic + character of the interior",
    sortOrder: 3,
  },
  {
    id: "architectural_style",
    displayLabel: "Architecture",
    description: "Era and architectural style of the home itself",
    sortOrder: 4,
  },
  {
    id: "exterior_features",
    displayLabel: "Exterior",
    description: "Yard, garage, deck, parking, scenic features",
    sortOrder: 5,
  },
  {
    id: "lifestyle_location",
    displayLabel: "Lifestyle",
    description: "Walkability, schools, transit, neighborhood feel",
    sortOrder: 6,
  },
  {
    id: "condition",
    displayLabel: "Condition",
    description: "Renovation level, finish state, age",
    sortOrder: 7,
  },
  {
    id: "amenities",
    displayLabel: "Amenities",
    description: "Office, gym, theater, solar — extras that matter",
    sortOrder: 8,
  },
  {
    id: "practical",
    displayLabel: "Practical",
    description: "HOA, HVAC, energy efficiency, wiring",
    sortOrder: 9,
  },
  {
    id: "avoidance_specific",
    displayLabel: "Avoidance",
    description: "Dealbreakers and push factors (red chips)",
    sortOrder: 10,
  },
];

export function getCategoryMeta(id: SoftPrefCategory): CategoryMeta {
  const meta = CATEGORIES.find((c) => c.id === id);
  if (!meta) {
    throw new Error(`Unknown soft-pref category: ${id}`);
  }
  return meta;
}
