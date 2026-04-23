

## Workflow steps as catalog references

Currently each workflow step is a free-text title with manually picked category/delivery/billing/duration. You want a step to **be** another catalog service — so a workflow service is literally a chain of existing catalog entries (and "Service 3 = Service 1 → Service 2" works without retyping anything).

### What changes in the UI

**`WorkflowStepsEditor.tsx`** — the per-step row becomes:

```text
[↑↓]  STEP 1   [ Catalog service ▼ AC service / repair        ]   [🗑]
                ├─ Title override (optional): [____________________]
                ├─ Duration override (days):  [___]
                └─ ☐ Blocks next step until done
```

- Replace the title `<Input>` with a **`CatalogPicker`** (searchable popover combobox) that lists every active catalog entry. This is the only required field per step.
- Drop the per-step Category / Delivery / Billing / Duration selects from the editor — those now come from the chosen catalog entry. (Show them as small read-only badges next to the picker, like `MAINTENANCE · VENDOR · PAID · ~2d`, so the user sees what they're chaining.)
- Keep two optional overrides: **Title override** (if you want this step labeled differently in the chained workflow, e.g. "Initial AC inspection" instead of "AC service / repair") and **Duration override**.
- Keep the **Blocks next step** switch.
- Prevent picking a workflow-type catalog entry as a step (no nested workflows in v1) — filter them out of the picker with a one-line note.

**`CatalogEntryDialog.tsx`** — validation in `save()`:
- For workflow services, every step must have a `catalog_id`. Drop the old "describe Other category" check on steps (no longer relevant; the step has no own category).

### What changes in data

**`WorkflowStep` type** (`src/lib/services.ts`) — slim it down:

```ts
export interface WorkflowStep {
  key: string;                       // stable slug
  catalog_id: string;                // NEW — the chained service
  title_override?: string | null;    // optional display override
  duration_override_days?: number | null;
  blocks_next: boolean;
}
```

`workflow_steps` is still stored as JSONB on `service_catalog`, so no schema migration is needed for the catalog table itself.

### What changes in the DB function

`create_service_request_from_catalog` already explodes `workflow_steps` into `service_request_steps`. Update the loop to **resolve each step's referenced catalog entry** and copy its defaults into the step row:

```sql
FOR v_step IN SELECT * FROM jsonb_array_elements(v_catalog.workflow_steps)
LOOP
  SELECT * INTO v_step_catalog
    FROM public.service_catalog
   WHERE id = (v_step->>'catalog_id')::uuid;

  IF v_step_catalog.id IS NULL THEN
    RAISE EXCEPTION 'Workflow step references missing catalog entry %', v_step->>'catalog_id';
  END IF;

  INSERT INTO public.service_request_steps (
    request_id, step_key, title, sort_order, category, category_other,
    delivery, billing, blocks_next, typical_duration_days
  ) VALUES (
    v_request_id,
    COALESCE(NULLIF(v_step->>'key',''), v_step_catalog.code),
    COALESCE(NULLIF(v_step->>'title_override',''), v_step_catalog.name),
    v_idx,
    v_step_catalog.category,
    v_step_catalog.category_other,
    v_step_catalog.default_delivery,
    v_step_catalog.default_billing,
    COALESCE((v_step->>'blocks_next')::boolean, false),
    COALESCE(
      NULLIF(v_step->>'duration_override_days','')::integer,
      v_step_catalog.typical_duration_days
    )
  );
  v_idx := v_idx + 1;
END LOOP;
```

### Backwards compatibility

Existing catalog rows whose `workflow_steps` already have inline `category`/`default_delivery`/`default_billing` (created before this change) will stop being expandable, since the new RPC requires `catalog_id`. To keep them working without forcing a manual rewrite, the RPC falls back to the legacy inline shape when `catalog_id` is missing (uses the old INSERT path). The editor, however, only writes the new shape going forward. Any legacy step opened in the editor without a `catalog_id` will show a yellow "Legacy step — pick a catalog service to upgrade" banner with the picker pre-focused.

### New component

**`src/components/services/CatalogPicker.tsx`** — a small Popover + Command searchable list of active, non-workflow catalog entries. Shows name, code, and category badge per row. Used by `WorkflowStepsEditor`. (This is distinct from the existing `CatalogPicker` in the new-request wizard if any; if one already exists, reuse it with a `filter={(e) => !e.is_workflow}` prop.)

### Files touched

- `src/lib/services.ts` — slim `WorkflowStep`, update `EMPTY_STEP`.
- `src/components/services/WorkflowStepsEditor.tsx` — replace inline editor with picker + overrides.
- `src/components/services/CatalogPicker.tsx` — new (or extend existing).
- `src/components/services/CatalogEntryDialog.tsx` — adjust validation.
- New migration — replace `create_service_request_from_catalog` with the catalog-resolving version (with legacy fallback).

