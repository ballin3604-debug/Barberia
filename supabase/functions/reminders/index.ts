// ─────────────────────────────────────────────────────────────
//  Recordatorios de cita (Supabase Edge Function — Deno)
//  Se ejecuta cada 15 minutos (ver supabase/reminders-setup.sql
//  para el cron y el README para el despliegue y los secrets).
//
//  Para cada cita de HOY, confirmada y dentro de la ventana de 2 h:
//   1. Envía un correo (Brevo) si el cliente dejó su email.
//   2. Envía una notificación Web Push (VAPID) si se suscribió.
//   3. Marca reminded_at para no repetir.
// ─────────────────────────────────────────────────────────────
import { createClient } from 'npm:@supabase/supabase-js@2';
import { webpush } from 'npm:web-push-libs/web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || '';
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || '';
const BREVO_FROM_EMAIL = Deno.env.get('BREVO_FROM_EMAIL') || '';
const BREVO_FROM_NAME = Deno.env.get('BREVO_FROM_NAME') || 'Barbería';
const APP_URL = Deno.env.get('APP_URL') || 'https://agenda-barberia-2190a.web.app';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:contacto@barberia.com';

const pad = (n: number): string => String(n).padStart(2, '0');
const todayStr = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

interface AppointmentRow {
  id: string;
  client_id: string;
  date: string;
  time: string;
  clients?: { email: string | null; full_name: string } | null;
}

const sendEmail = async (to: string, subject: string, html: string): Promise<boolean> => {
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: BREVO_FROM_EMAIL, name: BREVO_FROM_NAME },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

const sendPush = async (
  token: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url: string },
): Promise<boolean> => {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    await webpush.sendNotification(
      { endpoint: token.endpoint, keys: { p256dh: token.p256dh, auth: token.auth } },
      JSON.stringify(payload),
      { TTL: 7200 },
    );
    return true;
  } catch {
    return false;
  }
};

const reminderHtml = (name: string, date: string, time: string): string => `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
    <div style="background:#111827;color:#fff;padding:20px 24px">
      <strong style="font-size:18px">💈 ${BREVO_FROM_NAME}</strong>
    </div>
    <div style="padding:24px;color:#374151;font-size:14px;line-height:1.6">
      <p>Hola <strong>${name}</strong>, 👋</p>
      <p>Te recordamos que tu turno es <strong>en 2 horas</strong>:</p>
      <p style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;font-size:16px">
        📅 ${date}<br/>
        ⏰ <strong>${time} hs</strong>
      </p>
      <p>Si no vas a poder asistir, editá o cancelá tu turno desde el link antes del horario para
      que el barbero pueda reponerlo. 🙏</p>
      <a href="${APP_URL}/?view=client&date=${date}"
         style="display:inline-block;margin-top:8px;background:#059669;color:#fff;text-decoration:none;
                padding:12px 20px;border-radius:12px;font-weight:bold">
        Gestionar mi turno
      </a>
    </div>
  </div>`;

Deno.serve(async (req) => {
  // Solo el cron (con la service role key) puede invocarla
  if (req.headers.get('Authorization') !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const now = new Date();
  const today = todayStr(now);

  const { data: appts } = await sb
    .from('appointments')
    .select('id, client_id, date, time, clients(email, full_name)')
    .eq('date', today)
    .eq('status', 'confirmed')
    .is('reminded_at', null)
    .limit(100);

  let emails = 0;
  let pushes = 0;
  let marked = 0;

  for (const appt of (appts ?? []) as AppointmentRow[]) {
    const [h, m] = appt.time.split(':').map(Number);
    const when = new Date(now);
    when.setHours(h, m, 0, 0);
    const diffMs = when.getTime() - now.getTime();
    if (diffMs <= 0 || diffMs > 2 * 60 * 60 * 1000) continue;

    const name = appt.clients?.full_name || 'cliente';
    const dateDisplay = `${appt.date} a las ${appt.time}`;
    let anySent = false;

    // ── 1. Correo (Brevo) ──
    if (appt.clients?.email && BREVO_API_KEY && BREVO_FROM_EMAIL) {
      const ok = await sendEmail(
        appt.clients.email,
        `⏰ Tu cita es en 2 horas — ${dateDisplay}`,
        reminderHtml(name, appt.date, appt.time),
      );
      if (ok) {
        emails += 1;
        anySent = true;
      }
    }

    // ── 2. Notificación al navegador (Web Push) ──
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      const { data: tokens } = await sb
        .from('push_tokens')
        .select('endpoint,p256dh,auth')
        .eq('client_id', appt.client_id);
      for (const token of (tokens ?? []) as {
        endpoint: string;
        p256dh: string;
        auth: string;
      }[]) {
        const ok = await sendPush(token, {
          title: '⏰ Tu cita es en 2 horas',
          body: `${name}, te esperamos a las ${appt.time} 💈`,
          url: `${APP_URL}/?view=client&date=${appt.date}`,
        });
        if (ok) {
          pushes += 1;
          anySent = true;
        }
      }
    }

    if (anySent) {
      await sb
        .from('appointments')
        .update({ reminded_at: new Date().toISOString() })
        .eq('id', appt.id);
      marked += 1;
    }
  }

  return Response.json({ ok: true, emails, pushes, marked });
});
