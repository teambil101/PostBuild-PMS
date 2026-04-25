## Problem

Yahya's SQL queries are rejected with `only_select_allowed` even when they start with `SELECT`. Worse, the forbidden-keyword guard is silently broken too — meaning unsafe queries could pass.

## Root cause

The `public.run_readonly_sql` function uses Perl-style regex shortcuts (`\s`, `\b`) that **don't work** in Postgres POSIX regex:

```sql
if not (q_lower ~ '^\s*(select|with)\b') then  -- always false → rejects valid SELECTs
  raise exception 'only_select_allowed';
end if;
```

Verified via direct query: `'SELECT first_name FROM people' ~ '^\s*(select|with)\b'` returns `false`.

Postgres POSIX needs `[[:space:]]` for whitespace and `\y` for word boundaries.

## Fix

One small migration that replaces `public.run_readonly_sql` with corrected regex patterns:

- `\s` → `[[:space:]]`
- `\b` → `\y`
- Keep all other validation logic identical (auth check, role check, single-statement, forbidden schemas/functions, 8s timeout, 500-row cap)

This fixes both the false-negative (valid SELECTs being blocked) and the false-positive risk (forbidden keywords slipping past).

## Technical changes

- **New migration**: replaces `public.run_readonly_sql(text)` with corrected regex.
- No edge function or frontend changes needed.

After the migration applies, re-run "give me ahmed's contact info" — Yahya should return results.