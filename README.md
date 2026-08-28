<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# 💈 Agenda de Barbería

Sistema de citas para barbería con reserva online de clientes, referencia de corte por foto/video,
notificaciones por WhatsApp y agenda del barbero en tiempo real.

## 🔄 El flujo

1. **El barbero comparte el link** (botón «Compartir» en la vista del barbero): `?view=client&date=…`
2. **El cliente entra**, escribe su nombre y WhatsApp → el sistema lo **identifica**:
   - Cliente nuevo → _"¡Bienvenido! 😊"_
   - Cliente fijo → _"¡Hola de nuevo! 👋 Tu último corte fue hace 12 días"_
3. El cliente elige **día y horario** libre.
4. Agrega la **referencia de su corte**: link de TikTok/Instagram **o foto** subida a Supabase Storage.
5. La cita se guarda en **Supabase** y:
   - Si configuraste **Pabbly** → se envía un aviso automático por WhatsApp (webhook).
   - Si no → se abre WhatsApp con el mensaje listo hacia tu número.
6. La **agenda del barbero se actualiza en tiempo real** (Supabase Realtime) con la foto/referencia.

## 🚀 Puesta en marcha

### 1. Instalá dependencias

```bash
npm install
```

### 2. Conectá Supabase (base de datos)

1. Creá un proyecto gratis en [supabase.com](https://supabase.com) (USA / cualquier región).
2. Abrí **SQL Editor** → pegá TODO el contenido de [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   Esto crea las tablas (`clients`, `slots`, `appointments`, `day_config`, `business_settings`),
   las políticas de acceso, el Realtime y el bucket de Storage `references`.
3. Andá a **Project Settings → API** y copiá la _Project URL_ y la _anon key_.
4. Creá el archivo **`.env.local`** en la raíz del proyecto:

   ```bash
   VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
   VITE_SUPABASE_ANON_KEY="tu_anon_key"
   ```

5. Reiniciá el servidor (`npm run dev` o `npm run build`).

> 💾 La primera vez, la app te ofrece **migrar automáticamente** tu agenda de localStorage a Supabase.

### 3. Configurá el negocio

En la vista del barbero → **Ajustes**:

- Nombre de la barbería y tu número de WhatsApp.
- (Opcional) Webhook de Pabbly para notificaciones automáticas.

### 4. Publicá en Firebase Hosting

```bash
npm i -g firebase-tools
firebase login
firebase use --add        # elegí o creá tu proyecto Firebase
npm run deploy            # construye y sube (usa firebase.json)
```

El link público queda en `https://tu-proyecto.web.app`. Para abrir la vista de clientes:
`https://tu-proyecto.web.app/?view=client`.

## 📱 WhatsApp automático (Pabbly Connect)

> ⚠️ **Importante**: la API oficial de Meta **no permite enviar mensajes a grupos** de WhatsApp
> (solo 1 a 1). Por eso el aviso llega a **tu número** y lo reenvías al grupo con 2 taps — es lo
> máximo permitido oficialmente.

1. Creá una cuenta en [connect.pabbly.com](https://connect.pabbly.com) (plan gratis: ~100 tareas/mes).
2. Creá un **workflow** → trigger **Webhook** → copiá la URL de captura.
3. Agregá el paso **WhatsApp Cloud API** (de Meta) → conectá tu número de Business API.
   - Configurá el mensaje mapeando los campos del JSON que envía la app:
     `clientName`, `clientPhone`, `date`, `time`, `referenceUrl`, `referenceImageUrl`, `note`.
   - Ejemplo de texto: `💈 *Nueva reserva*\n👤 {{clientName}}\n📅 {{date}} ⏰ {{time}}…`
4. Probá el workflow (botón «Capture» en Pabbly) con una reserva de prueba.
5. En la app → **Ajustes** → activá _Notificaciones automáticas_ y pegá la URL del webhook.
6. Guardá. Cada cita nueva dispara el workflow.

**Plan B (sin Pabbly)**: si el webhook queda apagado, la app abre WhatsApp con el mensaje
listo hacia tu número cada vez que alguien reserva — funciona sin configurar nada.

## 🔔 Recordatorios automáticos (email + notificación del navegador)

La función [supabase/functions/reminders/index.ts](supabase/functions/reminders/index.ts) se
ejecuta cada 15 minutos y, para cada cita del día dentro de la ventana de 2 horas, envía:

- 📧 **Correo** al cliente (si dejó su email) vía [Brevo](https://www.brevo.com) (300 correos/día gratis).
- 🔔 **Notificación del navegador** (Web Push VAPID) si el cliente la aceptó al reservar.

Nunca repite: marca `reminded_at` tras el primer envío.

### Configurarlo (una sola vez)

1. **Cuenta de Brevo**: creá una en brevo.com → agregá tu email como *remitente* y verificá el
   correo de confirmación que te mandan → copiá tu **API key** (Settings → SMTP & API).
2. **Claves VAPID** (para push): ejecutá una vez
   ```bash
   npx web-push generate-vapid-keys
   ```
   Guardá la clave **pública** para el paso 4 y la **privada** para el paso 5.
3. **Deploy de la función** (con Supabase CLI):
   ```bash
   npm i -g supabase
   supabase login
   supabase functions deploy reminders --no-verify-jwt
   supabase secrets set \
     SERVICE_ROLE_KEY="TU_SERVICE_ROLE_KEY" \
     BREVO_API_KEY="TU_BREVO_API_KEY" \
     BREVO_FROM_EMAIL="tu@correo.com" \
     BREVO_FROM_NAME="Tu Barbería" \
     APP_URL="https://agenda-barberia-2190a.web.app" \
     VAPID_PUBLIC_KEY="CLAVE_PUBLICA" \
     VAPID_PRIVATE_KEY="CLAVE_PRIVADA" \
     VAPID_SUBJECT="mailto:tu@correo.com"
   ```
   (La SERVICE_ROLE_KEY está en Supabase → Project Settings → API — nunca la pongas en la app.)
4. **Clave pública en la app**: agregá a `.env.local`
   ```
   VITE_VAPID_PUBLIC_KEY="CLAVE_PUBLICA"
   ```
   y volvé a hacer `npm run deploy`.
5. **Programá el cron**: en el SQL Editor ejecutá
   [supabase/reminders-setup.sql](supabase/reminders-setup.sql) reemplazando
   `{{PROJECT_URL}}` y `{{SERVICE_ROLE_KEY}}`.

> 💡 El cliente ve "🔔 Recordatorio activado" al reservar si acepta el permiso. En iPhone (Safari/
> Chrome), las notificaciones solo funcionan con la app instalada desde la pantalla de inicio.
> El correo funciona en todos los dispositivos.

## 🛠️ Scripts

| Comando           | Descripción                                    |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | Servidor de desarrollo (http://localhost:3000) |
| `npm run build`   | Build de producción en `dist/`                 |
| `npm run preview` | Sirve el build localmente                      |
| `npm run deploy`  | Build + deploy a Firebase Hosting              |
| `npm run lint`    | Type-check + ESLint                            |
| `npm run format`  | Prettier                                       |
| `npm run clean`   | Elimina `dist/`                                |

## 🗂️ Estructura

```
src/
├── App.tsx                      # Enrutador: vista cliente (pública) / vista barbero
├── lib/
│   ├── supabase.ts              # Cliente de Supabase (env vars)
│   └── api.ts                   # Citas, clientes, slots, webhook, migración
├── components/
│   ├── client/ClientBookingView.tsx   # Reserva pública del cliente (identificación + referencia)
│   ├── barber/BarberAgendaView.tsx    # Agenda unificada del barbero (tiempo real)
│   ├── barber/SlotActionsModal.tsx    # Acciones por turno (agendar, atender, liberar)
│   ├── barber/HoursEditorModal.tsx    # Editor de horarios del día
│   ├── barber/ClientsPanelModal.tsx   # Clientes: historial y último corte
│   ├── SettingsModal.tsx        # Negocio + Pabbly + respaldo
│   ├── ReportsModal.tsx         # Reportes del período
│   └── Modal.tsx / Toast.tsx / ErrorBoundary.tsx
├── data/defaultData.ts          # Horarios estándar, fechas, settings locales
└── types.ts                     # Tipos TS + modelos de Supabase
```

## 🛠️ Stack

- React 19 + TypeScript (strict) + Vite + Tailwind CSS 4
- **Supabase**: Postgres, Realtime y Storage
- **Firebase Hosting** para producción
- **Pabbly Connect + WhatsApp Cloud API** para notificaciones (opcional)
