# Design reference

The Claude Design handoff bundle exported 2026-05-10. Contains HTML / CSS / JSX prototypes that define the visual language and interaction patterns for the V1 build.

**`ripple/project/RelAI V1.html`** is the canonical V1 mock — the user had this file open when triggering the handoff. Read this first when porting UI to `apps/web/`.

The directory is named `ripple/` because the project's pre-rename codename was Ripple (legacy). The contents are RelAI's design.

## Key files

| File | Role |
|---|---|
| `ripple/project/RelAI V1.html` | Canonical V1 mock — read top to bottom; follow imports |
| `ripple/project/Design Ideas.html` | Earlier exploratory ideation (some directions may be superseded) |
| `ripple/project/prototype/sidebar.jsx` | Left-rail folder list (Home Page) |
| `ripple/project/prototype/folder.jsx` | Client Folder page main container |
| `ripple/project/prototype/folder-tabs.jsx` | 3-surface carousel (Search / Outreach / Profile) |
| `ripple/project/prototype/smart-control.jsx` | Smart Control dashboard (green/red chips) |
| `ripple/project/prototype/orb3d.jsx` | 3D orb visualization on Home Page (Three.js) |
| `ripple/project/prototype/pool.jsx` | Results pool / listing grid |
| `ripple/project/prototype/tweaks-panel.jsx` | Runtime mood / pace / voice / density tweaks |
| `ripple/project/prototype/styles.css` + `styles-v2.css` | Design tokens, color palette per mood |
| `ripple/project/prototype/data.js` | Mock data shape (folders, listings, soft prefs) |
| `ripple/project/prototype/icons.jsx` | Icon set |
| `ripple/project/debug/*.png` | Screenshot references |
| `ripple/project/uploads/Sample RelAI Logo.png` | Logo asset |

## Porting discipline

Per the bundle's own README: **recreate pixel-perfectly** in the production stack (Next.js 15 + React 19 + Tailwind v4 + shadcn/ui + Radix UI + Framer Motion + Three.js). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

Do **not** render the HTML in a browser and screenshot it. Everything needed (dimensions, colors, layout rules, interaction patterns) is in the source. Read the HTML + CSS + JSX directly.
