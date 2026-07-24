# Automatización WhatsApp de ActiveSelfControl

## Arquitectura aplicada

La base de datos de ActiveSelfControl sigue siendo la fuente de verdad. El navegador solo crea mensajes en `crm_whatsapp_mensajes`; nunca recibe tokens de Meta, claves de OpenWA ni credenciales de n8n.

```text
CRM autenticado -> cola Supabase/RLS -> whatsapp-dispatch
                                      |-> Meta Cloud API
                                      `-> webhook HMAC n8n -> OpenWA (red Docker privada)
```

`whatsapp-dispatch` vuelve a leer el mensaje y la configuración con el JWT del usuario, por lo que no puede enviar datos de otro tenant. Para OpenWA+n8n firma `timestamp + cuerpo exacto` con HMAC-SHA256. n8n debe rechazar firmas inválidas y timestamps con más de cinco minutos.

## Recomendación de producción

Meta Cloud API es el proveedor recomendado para clientes B2B porque es la integración oficial y no depende de una sesión de WhatsApp Web. OpenWA+n8n queda como proveedor opcional para pilotos controlados; requiere vigilar desconexiones, QR, cambios de WhatsApp Web y las condiciones de uso aplicables.

Si se usa OpenWA, fijar una versión estable. La documentación actual marca `4.76.0` como línea madura y v5 como alpha. n8n también debe fijarse a una versión estable probada; no usar `latest` en producción.

## Despliegue n8n/OpenWA

1. Ejecutar n8n y OpenWA en la misma red Docker privada. Solo n8n necesita un endpoint HTTPS público; el puerto de OpenWA no debe publicarse en Internet.
2. Persistir `/home/node/.n8n` y el directorio de sesión de OpenWA en volúmenes privados.
3. Proteger OpenWA con `X-API-Key` y configurar una sesión distinta por número/tenant cuando corresponda.
4. En n8n crear el webhook de producción `POST /webhook/asc-whatsapp-dispatch`.
5. Primer nodo: verificar `X-ASC-Timestamp` y `X-ASC-Signature` contra `N8N_WHATSAPP_WEBHOOK_SECRET` antes de procesar el contenido.
6. Segundo nodo: HTTP Request a `http://openwa:8080/api/sendText`, con `X-API-Key`, usando:

```json
{
  "to": "={{ $json.to }}",
  "text": "={{ $json.text }}"
}
```

7. Terminar con `Respond to Webhook`, código 200 y el ID retornado por OpenWA. Si OpenWA falla, devolver 502; ActiveSelfControl marcará el mensaje como `error` y conservará el detalle para reintento.
8. Configurar los secretos remotos:

```bash
supabase secrets set \
  N8N_WHATSAPP_WEBHOOK_URL=https://n8n.example.com/webhook/asc-whatsapp-dispatch \
  N8N_WHATSAPP_WEBHOOK_SECRET=un-secreto-aleatorio-de-32-bytes-o-mas
```

9. En CRM > WhatsApp elegir `OpenWA mediante n8n`, guardar el ID de sesión y cambiar el estado a `conectado` solo después de completar el QR y una prueba real.

## Reglas de negocio

- `cliente_creado`: mensaje de bienvenida, una sola vez.
- `pago_vencido`: aviso de cobro con importe y fecha; detener cuando el pago sea `pagado` o `anulado`.
- `factura_emitida`: enviar referencia y total después de confirmar el pago/venta.
- `suscripcion_por_vencer`: ejecutar diariamente según `dias_antes` y evitar duplicados por suscripción, fecha y tipo.

n8n debe actuar como orquestador, no como base de datos paralela. Estados, plantillas, tenant, consentimiento, opt-out e historial permanecen en Supabase.

## Controles obligatorios

- No entregar `SUPABASE_SERVICE_ROLE_KEY` a un workflow n8n.
- No aceptar `tenant_id`, texto o destino enviados directamente por n8n para seleccionar registros del CRM.
- No exponer OpenWA públicamente.
- Filtrar eventos entrantes para evitar que el bot responda a sus propios mensajes.
- Aplicar límites por tenant, reintentos con backoff y una cola de errores.
- Guardar consentimiento y respetar solicitudes de baja antes de automatizar campañas.
