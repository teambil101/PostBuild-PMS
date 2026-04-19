
## True Build — Property Management Platform (v1 Foundation)

A studio-refined, AI-ready property management platform. We start with a rock-solid foundation: the app shell, design system, and the two backbone modules — **Properties** and **People** — built in parallel since they reference each other. Automation (n8n) and AI come in later passes once the core is bug-free.

---

### Scope of this build

**1. Design system & app shell**
- Implement DESIGN.md tokens as the foundation (we'll refine specifics together as we go):
  - Colors: Architect Black `#2E2C29`, Chalk White `#F8F6F3`, Brushed Gold `#C3A575`, Warm Stone `#D6CFC4`, True Taupe `#A89E92`, Smoked Bronze `#645D52`
  - Typography: Cormorant Garamond (display/headings), Inter (UI/body), IBM Plex Mono (reference codes & IDs)
  - Buttons: 2px radius, uppercase tracking on labels; Primary (black), Gold (CTA), Ghost, Danger
  - Cards: chalk white, 1px Warm Stone border, 4px Brushed Gold left border on hover/active — no shadows
- Persistent left sidebar (Architect Black, never collapses on desktop) with the 8 modules listed; only Properties + People are active in v1, others are visible-but-disabled placeholders so the architecture is visible from day one
- Top bar with breadcrumb, global search field (UI only for now), and user menu
- 1200px max content width, 1.5rem gutter
- Empty states, loading skeletons, and toast notifications styled to the system

**2. Properties module (full v1 — all four scope items)**
- **Buildings + Units hierarchy**: create/edit buildings; nest units under each building; basic specs (size, beds/baths, type, floor)
- **Photos & documents**: per-property image gallery and document storage (floor plans, certificates, inspection reports)
- **Status & availability tracking**: Vacant / Occupied / Under Maintenance / Off-Market with timestamped status history
- **Map / location view**: geocoded addresses, portfolio-wide map browsing, click pin → property detail
- Property reference codes (e.g. `MZK001`) rendered in IBM Plex Mono
- List view, grid view, and detail view per property; filters by status, type, building

**3. People module (v1)**
- Unified people directory: tenants, owners, prospects, staff, vendors-as-people
- Profile per person: contact info, role tags, linked properties/units, notes, document attachments, activity timeline
- Cross-link with Properties (e.g. "Occupant of Unit 3B")
- Search and filter by role, property association, status

**4. Data foundation (Lovable Cloud)**
- Tables: `buildings`, `units`, `property_documents`, `property_status_history`, `people`, `people_property_links`, `people_documents`
- Storage buckets for property photos and documents (with RLS)
- Auth (email + password) with a `user_roles` table (admin / staff / viewer) using a security-definer `has_role()` function — roles never on the profile table
- RLS on every table from day one

**5. Module shell for the rest** (placeholders, not built)
- Contracts, CRM/Lease lifecycle, Tickets & Workflows, Dashboards, Vendors, Services appear in the sidebar with "Coming soon" pages so the platform shape is visible

---

### Deliberately deferred (next passes)

- n8n workflow integration (will wire via webhooks + edge functions when we move to the automation pass)
- AI features (property descriptions, document Q&A, smart status suggestions)
- Contracts module (#3)
- CRM / Lease lifecycle (#4)
- Tickets & Workflows automation engine (#5)
- Dashboards / Homepages (#6)
- Vendors module (#7)
- Services module (#8)

---

### Working principles for this project

- **Bug-free first**: every feature ships with proper empty/loading/error states, validated forms, and tested flows before we move on
- **One module at a time** after this foundation — we won't touch Contracts until Properties + People feel polished
- **Design refinement is iterative**: DESIGN.md is the base; we'll tune spacing, density, and component behavior as real screens come together
- **Architecture-ready for automation**: data model, edge functions, and event hooks designed now so n8n + AI slot in cleanly later

After approval I'll set up Lovable Cloud (auth, database, storage), build the design system + shell, then Properties and People in parallel.
