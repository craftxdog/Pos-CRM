# ActiveSelfControl (ASC)

ActiveSelfControl es un POS con CRM integrado: mantiene ventas, productos, caja, inventario y reportes, y agrega control de clientes, invitaciones por correo, suscripciones, mensualidades, pagos, horarios, asistencia, trabajadores, cargos y permisos por rol/modulo.

El CRM incluye un flujo rápido para seleccionar cliente y plan, crear la suscripción y el cobro en una sola transacción e imprimir la factura en A4. El POS permanece separado de este flujo.

## Stack

- React + Vite
- Supabase Auth, Postgres, Storage y Data API
- Zustand + TanStack Query
- Styled Components
- Docker + Nginx para despliegue SPA

## Desarrollo local

```bash
npm install
npm run dev
```

Variables requeridas:

```bash
VITE_APP_SUPABASE_URL=
VITE_APP_SUPABASE_ANON_KEY=
```

## Base de datos

Las migraciones principales del CRM estan en:

```bash
supabase/migrations/20260710161633_active_self_control_crm.sql
supabase/migrations/20260724201131_crm_billing_and_invitation.sql
supabase/migrations/20260726064329_crm_membership_workspace.sql
supabase/migrations/20260726065415_remove_duplicate_crm_plan_index.sql
```

La migracion agrega RLS, grants explicitos para `authenticated`, tablas CRM, permisos por rol/modulo, vista `crm_resumen_clientes` con `security_invoker`, y compatibilidad con bases antiguas que usan `clientes` en vez de `clientes_proveedores`.

La vista `crm_suscripciones_operativas` alimenta la lista paginada y calcula cuatro estados de negocio:

- `activa`: vigente y con más de 7 días restantes.
- `por_vencer`: vence dentro de los próximos 7 días.
- `inactiva`: pausada, cancelada o fuera de vigencia.
- `morosa`: tiene al menos un cobro vencido pendiente.

Los clientes registrados desde la caja del POS se sincronizan automáticamente con `clientes_crm`; el alta manual del CRM continúa sincronizándose hacia `clientes_proveedores`.

Aplicar contra el proyecto correcto:

```bash
supabase db push
```

## Invitaciones por correo

Las invitaciones se envían desde la función autenticada `crm-send-invitation`. El navegador no recibe credenciales SMTP. Configura los secretos indicados en `.env.example` dentro del proyecto Supabase y despliega la función:

```bash
supabase secrets set --env-file supabase/.env.crm
supabase functions deploy crm-send-invitation
```

`supabase/.env.crm` debe permanecer fuera de Git. `APP_SITE_URL` debe apuntar al origen público de la aplicación para que el enlace regrese a `/onboarding-cliente`.

Para Hostinger usa `smtp.hostinger.com`, puerto `465` y SSL implícito. Si el proyecto conserva los secretos con prefijo `MAILERSEND_*`, esos nombres siguen siendo compatibles, pero deben contener las credenciales de Hostinger y `MAILERSEND_ENABLED=true`; el prefijo no cambia el proveedor. Un error `MS42225` identifica una cuenta de prueba de MailerSend limitada, no un error de la interfaz del CRM.

Estados visibles de invitación: preparando envío, enviada/esperando registro, aceptada, expirada, cancelada y error de envío. El estado de entrega SMTP se almacena por separado del estado de aceptación.

Despues de aplicar, ejecutar advisors de seguridad y rendimiento:

```bash
supabase db advisors --type security
supabase db advisors --type performance
```

## Docker

```bash
docker compose --env-file .env up --build
```

La app queda en:

```bash
http://localhost:8080
```

## Seguridad

- No se usa `service_role` en frontend.
- Las tablas nuevas tienen RLS habilitado.
- Los clientes invitados solo pueden ver/crear su propio perfil mediante email autenticado.
- Los administradores gestionan parametros, modulos, permisos, trabajadores, planes y horarios.
- Nginx incluye cabeceras de seguridad y CSP compatible con Supabase.

## Verificacion

```bash
npm run build
npm run lint
```

Nota: el cambio de nombre de organizacion/proyecto en Supabase Dashboard requiere sesion de propietario en el navegador. El conector actual no expone una organizacion llamada `test`.
