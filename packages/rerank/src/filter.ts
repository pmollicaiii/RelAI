/**
 * Filter-pass primitives (Pillar 3 step 1).
 *
 * The filter applies ONLY the search query's hard preferences. The
 * client.md NEVER restricts the filter (CLAUDE.md §6.4) — its hard
 * constraints surface as advisory flags on candidates that violate them,
 * not exclusions.
 *
 * The DB layer translates these into SQL WHERE clauses. This module is
 * the pure-function interface so the same filter logic can be tested
 * without a DB.
 */

export interface SearchFilter {
  transactionMode?: "sale" | "lease";
  priceMin?: number;
  priceMax?: number;
  bedsMin?: number;
  bedsMax?: number;
  bathsMin?: number;
  sqftMin?: number;
  zips?: string[];
  cities?: string[];
  townships?: string[];
  schoolDistrict?: string;
}

export interface ListingForFilter {
  id: string;
  transactionMode: "sale" | "lease";
  price: number | null;
  beds: number | null;
  bathsFull: number | null;
  bathsPartial: number | null;
  sqftInterior: number | null;
  zip: string | null;
  city: string | null;
  township: string | null;
}

/**
 * Returns true if `listing` passes every defined constraint in `filter`.
 * Missing fields on the listing are treated as "unknown" — they fail
 * filters that require a minimum/maximum (conservative).
 */
export function applyFilter(listing: ListingForFilter, filter: SearchFilter): boolean {
  if (filter.transactionMode && listing.transactionMode !== filter.transactionMode) return false;

  if (filter.priceMin !== undefined) {
    if (listing.price === null || listing.price < filter.priceMin) return false;
  }
  if (filter.priceMax !== undefined) {
    if (listing.price === null || listing.price > filter.priceMax) return false;
  }
  if (filter.bedsMin !== undefined) {
    if (listing.beds === null || listing.beds < filter.bedsMin) return false;
  }
  if (filter.bedsMax !== undefined) {
    if (listing.beds === null || listing.beds > filter.bedsMax) return false;
  }
  if (filter.bathsMin !== undefined) {
    const totalBaths = (listing.bathsFull ?? 0) + (listing.bathsPartial ?? 0) * 0.5;
    if (totalBaths < filter.bathsMin) return false;
  }
  if (filter.sqftMin !== undefined) {
    if (listing.sqftInterior === null || listing.sqftInterior < filter.sqftMin) return false;
  }
  if (filter.zips && filter.zips.length > 0) {
    if (!listing.zip || !filter.zips.includes(listing.zip)) return false;
  }
  if (filter.cities && filter.cities.length > 0) {
    if (!listing.city || !filter.cities.includes(listing.city)) return false;
  }
  if (filter.townships && filter.townships.length > 0) {
    if (!listing.township || !filter.townships.includes(listing.township)) return false;
  }

  return true;
}

/**
 * Apply the filter to a batch of listings. Returns the surviving subset
 * with stable order preserved.
 */
export function filterListings<T extends ListingForFilter>(
  listings: T[],
  filter: SearchFilter,
): T[] {
  return listings.filter((l) => applyFilter(l, filter));
}
