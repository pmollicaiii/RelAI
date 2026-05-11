# Seed data

Read-only reference data used at ingest time (Pillar 1, Week 2 of the build plan).

## `mls/`

18 Bright MLS training-data exports (9 PA/NJ/DE counties × Residential Sale + Residential Lease). Mix of `.csv` and `.xlsx`. ~37 MB, ~17,264 rows total.

Source: Bright MLS exports captured 2026-04-19. Used as the listings corpus for V1 dogfood.

**Field schema**: 95 unique columns across all 18 files (union). See `docs/phase-1-plan.md` §8 for the 6-tier vectorization recipe that consumes these.

**Replacement**: When Bright API credentials land, the file transport is swapped for live API ingest. The schema is field-additive — new RESO fields slot into Tier 1 (typed columns) or Tier 2/3 (ontology-mapped) without recipe-version bump unless they're load-bearing for re-rank.
