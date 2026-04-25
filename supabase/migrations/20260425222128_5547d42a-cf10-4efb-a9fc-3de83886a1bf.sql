-- Remove the workspace invitations module entirely
DROP FUNCTION IF EXISTS public.accept_workspace_invitation(text);
DROP FUNCTION IF EXISTS public.lookup_invitation(text);
DROP TABLE IF EXISTS public.workspace_invitations CASCADE;