-- Delete child rows first, then the parent contract
DELETE FROM contract_subjects WHERE contract_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM contract_parties WHERE contract_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM leases WHERE contract_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM contracts WHERE id = '11111111-1111-1111-1111-111111111111';

-- Restore unit to original state (was occupied with no lock before the test)
UPDATE units SET status = 'occupied', status_locked_by_lease_id = NULL
WHERE id = 'ca66fe97-4cdf-4b09-be89-2cabb948610a';

-- Trim the smoke-test history rows so the audit log stays clean
DELETE FROM unit_status_history
WHERE unit_id = 'ca66fe97-4cdf-4b09-be89-2cabb948610a'
  AND reason LIKE '%LSE-TEST-0001%';