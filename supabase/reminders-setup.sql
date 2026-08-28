-- ═══════════════════════════════════════════════════════════════
--  RECORDATORIOS AUTOMÁTICOS — programación (pg_cron)
--  ⚠️ Ejecutar DESPUÉS de:
--     1. Desplegar la función:  supabase functions deploy reminders --no-verify-jwt
--     2. Configurar secrets (ver README → Recordatorios)
--     3. Reemplazar los valores entre {{ }} por los reales:
--        {{PROJECT_URL}}    = https://xpospolvqbdpnnxphmji.supabase.co
--        {{SERVICE_ROLE_KEY}}= clave service_role de tu proyecto (Settings → API)
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

select cron.unschedule('recordar-citas')
where exists (select 1 from cron.job where jobname = 'recordar-citas');

select cron.schedule(
  'recordar-citas',
  '*/15 * * * *',   -- cada 15 minutos
  $$
  select net.http_post(
    url := '{{PROJECT_URL}}/functions/v1/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer {{SERVICE_ROLE_KEY}}'
    ),
    body := '{}'::jsonb
  )
  $$
);

-- Verificar: la tarea debe aparecer en la lista
select jobname, schedule, active from cron.job where jobname = 'recordar-citas';
