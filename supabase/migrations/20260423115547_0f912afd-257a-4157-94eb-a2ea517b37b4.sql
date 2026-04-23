-- Drop the Tickets and Services modules entirely.
-- These tables and all their dependent objects (foreign keys, indexes, triggers) will be removed.
-- A future Work/Activities module will be designed from scratch.

DROP TABLE IF EXISTS public.ticket_workflow_steps CASCADE;
DROP TABLE IF EXISTS public.ticket_workflow_stages CASCADE;
DROP TABLE IF EXISTS public.ticket_events CASCADE;
DROP TABLE IF EXISTS public.tickets CASCADE;

DROP TABLE IF EXISTS public.service_schedule_events CASCADE;
DROP TABLE IF EXISTS public.service_schedules CASCADE;
DROP TABLE IF EXISTS public.service_agreements CASCADE;