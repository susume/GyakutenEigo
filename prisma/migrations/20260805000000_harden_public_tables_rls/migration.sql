-- QuizStrike uses Supabase as a server-side PostgreSQL database. The browser
-- talks only to the application server, so Supabase's anon/authenticated API
-- roles must not have direct access to application tables.
--
-- RLS is intentionally enabled without permissive policies: the application
-- server connects with its protected PostgreSQL connection, while requests
-- through Supabase's Data API are denied by default. The conditional role
-- check keeps this migration runnable against the local PostgreSQL setup too.

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'User',
    'Class',
    'QuizSet',
    'Folder',
    'Question',
    'QuestionAudio',
    'GameSession',
    'PlayerSession',
    'AnswerLog',
    'RoundLog',
    'Report',
    'RuntimeSnapshot',
    '_prisma_migrations',
    'Competition',
    'CompetitionStudyPack',
    'CompetitionAnnouncement',
    'CompetitionTeam',
    'CompetitionMatch',
    'CompetitionNotification',
    'CompetitionAuditLog',
    'Tournament',
    'TournamentStudyPack',
    'TournamentStudyItem',
    'TournamentTeam',
    'TournamentMatch',
    'TournamentAuditEvent'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public.%I FROM anon, authenticated',
        table_name
      );
    END IF;
  END LOOP;
END
$$;
