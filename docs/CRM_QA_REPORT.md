# Informe de QA del CRM

Fecha: 20 de agosto de 2026

## Correcciones aplicadas

- Se corrigió una regla CSS mal cerrada en el formulario de clientes que hacía que el bloque de avisos transaccionales se expandiera verticalmente y rompiera la jerarquía visual.
- Se reforzó la cuadrícula del directorio de clientes con columnas mínimas, separación consistente y truncado seguro para evitar encabezados y valores concatenados.
- El historial de notificaciones ahora permite buscar por cliente, destino o error y filtrar por canal, estado y evento.
- Los mensajes de correo y WhatsApp incluyen un saludo con el nombre del cliente y la empresa. El contenido conserva el motivo específico: vencimiento, mora, factura o bienvenida.
- Entradas mensuales ahora permite filtrar por método de pago además del período mensual.

## Verificaciones ejecutadas

- Pruebas automatizadas: 40 aprobadas.
- ESLint: aprobado sin advertencias.
- Build de producción con Vite: aprobado.
- Firebase Hosting: despliegue publicado y HTTP 200 verificado.
- Bundle publicado: contiene los filtros del historial y entradas mensuales.
- Edge Function `crm-notifications-run`: desplegada en Supabase.

## Observaciones operativas

- La entrega real por WhatsApp requiere configurar `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_GRAPH_API_VERSION` (o el webhook N8N correspondiente) en los secretos de producción. Sin esas credenciales, los avisos quedan registrados como error de configuración, no como fallos silenciosos.
- La entrega de correo requiere que el cliente tenga un correo válido y que SMTP esté habilitado; los clientes sin correo se omiten con motivo registrado.
- La revisión visual autenticada del tenant debe hacerse con una cuenta operativa; la página pública de producción responde correctamente, pero el acceso al CRM está protegido por autenticación.

## Segunda ronda de mejoras

- Cola manual de WhatsApp e historial automático: paginación fija de 10, búsqueda y filtros por tipo, canal, estado y evento; el contador se reinicia correctamente al cambiar filtros.
- Suscripciones: página inicial de 10 registros, leyenda visual de estados, filtro explícito para inactivas/vencidas y fecha inicial basada en la zona local para evitar desfases nocturnos.
- Entradas mensuales: navegación de mes anterior/siguiente, selector de método y etiqueta legible del período; el reporte conserva la selección al cambiar de mes.
- Se repitieron pruebas automatizadas, lint y build después de estos cambios: 40 pruebas aprobadas y compilación exitosa.
