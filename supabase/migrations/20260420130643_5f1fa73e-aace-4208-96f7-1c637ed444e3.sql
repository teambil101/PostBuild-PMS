-- §7.1: initialize lease_renewal workflow
SELECT initialize_ticket_workflow(
  'c304982b-c7b9-404c-ab9f-f1e5b9e38255'::uuid,
  'lease_renewal',
  '[
    {"key":"outreach","label":"Outreach","steps":[
      {"key":"outreach_initial","label":"Send initial renewal offer","required":true},
      {"key":"outreach_response","label":"Tenant response received","required":true},
      {"key":"outreach_followup","label":"Follow up if no response","required":false}
    ]},
    {"key":"negotiation","label":"Negotiation","steps":[
      {"key":"negotiation_market_comps","label":"Gather market comps","required":true},
      {"key":"negotiation_proposal","label":"Propose renewal terms","required":true},
      {"key":"negotiation_landlord","label":"Landlord approves terms","required":true},
      {"key":"negotiation_tenant","label":"Tenant accepts terms","required":true}
    ]},
    {"key":"documentation","label":"Documentation","steps":[
      {"key":"doc_draft","label":"Draft renewal contract or addendum","required":true},
      {"key":"doc_sign_landlord","label":"Landlord signs","required":true},
      {"key":"doc_sign_tenant","label":"Tenant signs","required":true},
      {"key":"doc_cheques","label":"New cheques collected","required":true},
      {"key":"doc_deposit","label":"Deposit top-up collected (if any)","required":false}
    ]},
    {"key":"activation","label":"Activation","steps":[
      {"key":"activation_ejari","label":"Ejari updated","required":true},
      {"key":"activation_archive","label":"Old contract archived","required":true},
      {"key":"activation_confirm","label":"All parties notified","required":true}
    ]}
  ]'::jsonb
);

-- §7.2: complete a single step
SELECT complete_ticket_step(
  'c304982b-c7b9-404c-ab9f-f1e5b9e38255'::uuid,
  'outreach', 'outreach_initial', 'Sent renewal offer email'
);

-- §7.3: try to advance with required step still pending → should fail.
-- We swallow the exception so the migration doesn't roll back; the
-- error is captured in a temp log table for inspection afterwards.
CREATE TEMP TABLE _smoke_log(step text, outcome text);
DO $$
BEGIN
  PERFORM advance_ticket_stage('c304982b-c7b9-404c-ab9f-f1e5b9e38255'::uuid);
  INSERT INTO _smoke_log VALUES ('advance_with_pending', 'UNEXPECTED SUCCESS');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _smoke_log VALUES ('advance_with_pending', 'expected_error: ' || SQLERRM);
END $$;

-- Persist that single notice into ticket_events as a debug breadcrumb
INSERT INTO ticket_events (ticket_id, event_type, description)
SELECT 'c304982b-c7b9-404c-ab9f-f1e5b9e38255'::uuid, 'updated',
       '[smoke §7.3] ' || outcome
  FROM _smoke_log WHERE step = 'advance_with_pending';

-- §7.4: complete the remaining required step in Outreach, then advance
SELECT complete_ticket_step(
  'c304982b-c7b9-404c-ab9f-f1e5b9e38255'::uuid,
  'outreach', 'outreach_response', NULL
);

SELECT advance_ticket_stage('c304982b-c7b9-404c-ab9f-f1e5b9e38255'::uuid);
