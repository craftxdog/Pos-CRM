# Arquitectura SaaS de ActiveSelfControl

## Límites del producto

- **POS:** ventas, productos, inventario, almacenes, cajas, comprobantes, reportes de producto y configuración fiscal.
- **CRM:** clientes del gimnasio, membresías, pagos recurrentes, asistencia, horarios, trabajadores, permisos y automatización de WhatsApp.
- Ambos dominios comparten identidad, empresa/tenant y catálogo de capacidades, pero no mezclan navegación ni reglas de negocio.

## Identidad y aislamiento

- Las entidades SaaS nuevas usan UUID como llave primaria y foránea.
- Las tablas históricas conservan su llave numérica interna para no romper datos ni contratos existentes, y exponen `public_id uuid` único para URLs, RPC y nuevas integraciones.
- El UUID evita IDs predecibles, pero la autorización real depende de RLS. Cada acceso autenticado se resuelve mediante `tenant_memberships` y se filtra por tenant en PostgreSQL.
- `tenant_id` nunca debe aceptarse como una verdad enviada por el navegador. Se deriva del usuario autenticado.

## Planes y capacidades

Las capacidades iniciales son `pos`, `crm`, `whatsapp_automation` y `advanced_reports`. Los planes `basic`, `growth` y `premium` las combinan mediante `saas_plan_features`. Una excepción comercial se registra en `tenant_feature_overrides`, con fecha de expiración opcional.

La interfaz oculta módulos no contratados, pero la barrera definitiva está en las políticas RLS restrictivas. Una ruta o botón oculto nunca sustituye la autorización del servidor.

## Suscripciones y Stripe

1. Crear Product y Price recurrente en Stripe para cada plan.
2. Guardar sus IDs en `saas_plans.stripe_product_id` y `saas_plans.stripe_price_id` desde un proceso administrativo, nunca desde el cliente.
3. Invocar `create-checkout-session` desde una sesión autenticada. La función valida que el usuario sea owner/admin, obtiene el precio desde la base e incluye `tenant_id` y `plan_id` como metadata de la sesión/suscripción.
4. Registrar el endpoint `https://cqnfziultbkobdkegtfm.supabase.co/functions/v1/stripe-webhook` para:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Configurar el secreto: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`.
6. Probar con Stripe CLI antes de activar cobros reales.

El webhook verifica la firma, registra el `event.id` para idempotencia y actualiza `tenant_subscriptions`. La aplicación concede acceso por el estado local sincronizado; nunca por el redirect de Checkout. `create-billing-portal` abre el portal de autoservicio únicamente para owner/admin del tenant autenticado.

## Impuestos, costo y ganancia

- `empresa.valor_impuesto` admite de 0 a 100 y `empresa.precios_incluyen_impuesto` define si el precio ya contiene el impuesto.
- `productos.aplica_impuesto` permite excepciones por producto.
- PostgreSQL calcula y guarda subtotal, impuesto, costo y ganancia de cada línea. La ganancia es ingreso antes de impuesto menos costo, no total cobrado menos costo.
- `confirmar_venta` vuelve a calcular los totales y rechaza un total del cliente que no coincida.
- El frontend usa centavos enteros para evitar errores binarios de JavaScript.

## Operación antes de producción

- Configurar `STRIPE_WEBHOOK_SECRET`, Products y Prices reales.
- Habilitar protección contra contraseñas filtradas en Supabase Auth si el plan contratado la incluye.
- Ejecutar `npm test`, `npm run lint`, `npm run build` y `supabase db advisors --linked` en CI.
- Ejecutar `supabase/tests/pos_saas_smoke.sql` contra staging después de cada migración.
- Revisar periódicamente membresías huérfanas, webhooks fallidos y suscripciones `past_due`, `unpaid` o `canceled`.
