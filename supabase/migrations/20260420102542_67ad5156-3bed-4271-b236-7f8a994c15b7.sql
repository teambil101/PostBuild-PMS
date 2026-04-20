-- Prune contract_parties.role CHECK: remove lessor/lessee/witness; add seller/buyer/issuer/recipient.
-- Backfill any existing rows: lessor→landlord, lessee→tenant, witness→other.

-- Defensive backfill (no rows expected per pre-check, but safe to run).
UPDATE public.contract_parties SET role = 'landlord' WHERE role = 'lessor';
UPDATE public.contract_parties SET role = 'tenant'   WHERE role = 'lessee';
UPDATE public.contract_parties SET role = 'other'    WHERE role = 'witness';

-- Replace CHECK constraint with the new allowed set.
ALTER TABLE public.contract_parties DROP CONSTRAINT IF EXISTS contract_parties_role_check;
ALTER TABLE public.contract_parties ADD CONSTRAINT contract_parties_role_check
  CHECK (role = ANY (ARRAY[
    'landlord','tenant','service_provider','client','broker',
    'guarantor','seller','buyer','issuer','recipient','other'
  ]::text[]));