alter table public.crm_whatsapp_config
  drop constraint if exists crm_whatsapp_config_proveedor_check;

alter table public.crm_whatsapp_config
  add constraint crm_whatsapp_config_proveedor_check
  check (proveedor in ('meta_cloud', 'openwa_n8n', 'manual'));
