# ActiveSelfControl (ASC)

ActiveSelfControl es un POS con CRM integrado: mantiene ventas, productos, caja, inventario y reportes, y agrega control de clientes, invitaciones por correo, suscripciones, mensualidades, pagos, horarios, asistencia, trabajadores, cargos y permisos por rol/modulo.

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

La migracion CRM esta en:

```bash
supabase/migrations/20260710161633_active_self_control_crm.sql
```

La migracion agrega RLS, grants explicitos para `authenticated`, tablas CRM, permisos por rol/modulo, vista `crm_resumen_clientes` con `security_invoker`, y compatibilidad con bases antiguas que usan `clientes` en vez de `clientes_proveedores`.

Aplicar contra el proyecto correcto:

```bash
supabase db push
```

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
