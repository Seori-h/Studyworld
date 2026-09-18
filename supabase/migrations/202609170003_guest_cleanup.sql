create extension if not exists pg_cron;

select cron.schedule(
  'studyworld-guest-score-cleanup',
  '17 * * * *',
  'select private.cleanup_guest_scores();'
);
