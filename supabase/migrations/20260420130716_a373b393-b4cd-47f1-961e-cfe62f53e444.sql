-- §7.5: change_ticket_workflow lease_renewal → move_in (empty preserved keys)
SELECT change_ticket_workflow(
  'c304982b-c7b9-404c-ab9f-f1e5b9e38255'::uuid,
  'move_in',
  '[
    {"key":"prearrival","label":"Pre-arrival","steps":[
      {"key":"prearrival_deposit","label":"Security deposit received","required":true},
      {"key":"prearrival_cheques","label":"Rent cheques collected","required":true},
      {"key":"prearrival_docs","label":"Tenant documents collected","required":true},
      {"key":"prearrival_contract","label":"Signed contract received","required":true},
      {"key":"prearrival_ejari","label":"Ejari submitted","required":true}
    ]},
    {"key":"unit_prep","label":"Unit preparation","steps":[
      {"key":"prep_cleaning","label":"Cleaning completed","required":true},
      {"key":"prep_pest","label":"Pest control completed","required":false},
      {"key":"prep_inspection","label":"Pre-handover inspection done","required":true},
      {"key":"prep_keys","label":"Keys and access cards prepared","required":true}
    ]},
    {"key":"handover","label":"Handover","steps":[
      {"key":"handover_walkthrough","label":"Walkthrough with tenant completed","required":true},
      {"key":"handover_keys","label":"Keys handed to tenant","required":true},
      {"key":"handover_parking","label":"Parking slot assigned","required":false},
      {"key":"handover_contacts","label":"Building contacts shared","required":true}
    ]},
    {"key":"post_move_in","label":"Post move-in","steps":[
      {"key":"postmove_dewa","label":"DEWA transfer confirmed","required":true},
      {"key":"postmove_checkin","label":"48-hour check-in completed","required":true},
      {"key":"postmove_issues","label":"Initial issues addressed","required":false}
    ]}
  ]'::jsonb,
  ARRAY[]::text[]
);

-- §7.6: remove_ticket_workflow
SELECT remove_ticket_workflow('c304982b-c7b9-404c-ab9f-f1e5b9e38255'::uuid);
