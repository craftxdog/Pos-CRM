# Notificaciones transaccionales del CRM

## Cobertura

El CRM comunica por correo y WhatsApp cuatro eventos que requieren acción o confirman una operación importante:

| Evento | Motivo | Momento de envío | Idempotencia |
| --- | --- | --- | --- |
| Suscripción próxima a vencer | Evitar interrupciones y facilitar la renovación | Al entrar en la ventana configurada, 7 días por defecto | Suscripción + nueva fecha de fin + canal |
| Pago vencido | Dar seguimiento a cartera sin campañas manuales | Cuando el cobro pendiente supera su fecha de vencimiento | Pago + fecha de vencimiento + canal |
| Pago/factura confirmada | Dar seguridad y constancia al cliente | Para pagos confirmados durante las últimas 48 horas | Pago + fecha de pago + canal |
| Cliente creado | Confirmar el alta y explicar qué avisos recibirá | Para altas realizadas durante las últimas 48 horas | Cliente + fecha de alta + canal |

No se automatizan promociones, cumpleaños ni campañas masivas. Esas comunicaciones requieren una finalidad comercial y consentimiento separado; mezclar esas campañas con los avisos transaccionales aumentaría el riesgo de spam y de bloqueo en Meta.

## Ejecución y seguridad

- Postgres Cron ejecuta `crm-notifications-run` todos los días a las 13:00 UTC, equivalentes a las 07:00 en Nicaragua.
- El secreto de invocación se genera durante la migración y permanece cifrado en Supabase Vault.
- La Edge Function usa el rol de servicio solo en el servidor. Ninguna credencial SMTP, de Meta o de Supabase llega al navegador.
- `crm_notificacion_envios` conserva destino, estado, intentos, error e identificador del proveedor.
- La clave de deduplicación impide repetir una entrega ya enviada aunque el job vuelva a ejecutarse.
- Los errores se reintentan hasta cinco veces. Un cliente puede desactivar correo o WhatsApp de forma independiente desde su ficha.
- Meta Cloud API usa siempre la plantilla aprobada correspondiente para estos mensajes iniciados por la empresa.

## Operación

La pantalla **CRM → Notificaciones** permite:

- configurar Meta Cloud API u OpenWA mediante n8n;
- editar las plantillas de WhatsApp;
- activar o pausar cada evento por canal;
- ajustar los días de anticipación para el vencimiento;
- ver las últimas 100 entregas automáticas y el motivo de cualquier error;
- mantener una cola manual de WhatsApp para casos excepcionales.

Los secretos SMTP existentes de `crm-send-invitation` y `crm-send-receipt` también son usados por el ejecutor automático. Las variables opcionales son:

```bash
supabase secrets set \
  CRM_NOTIFICATIONS_TIME_ZONE=America/Managua \
  CRM_NOTIFICATIONS_MAX_PER_RUN=200
```

## Verificación de producción

Después de desplegar la función y aplicar la migración:

1. Confirmar que `crm-notifications-daily` aparece en **Integrations → Cron**.
2. Ejecutar el job una vez o invocar la función con `dry_run: true` usando el secreto de Vault.
3. Revisar `cron.job_run_details`, los logs de la Edge Function y `crm_notificacion_envios`.
4. Confirmar que las plantillas `asc_bienvenida_cliente`, `asc_nota_cobro`, `asc_factura_electronica` y `asc_suscripcion_por_vencer` están aprobadas en Meta para el idioma configurado.
