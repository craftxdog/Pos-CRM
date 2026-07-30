-- Stable public-facing client codes for CRM/POS.
create or replace function private.crm_assign_client_code()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if nullif(btrim(new.codigo), '') is null then
    new.codigo := 'CLI-' || lpad(new.id::text, 6, '0');
  else
    new.codigo := upper(btrim(new.codigo));
  end if;

  return new;
end;
$function$;

revoke all on function private.crm_assign_client_code()
from public, anon, authenticated;

drop trigger if exists trg_clientes_crm_assign_code
on public.clientes_crm;

create trigger trg_clientes_crm_assign_code
before insert or update of codigo
on public.clientes_crm
for each row execute function private.crm_assign_client_code();

-- Repair the two-way CRM/POS contact sync for legacy records where an email
-- was saved in the address field. The existing CRM -> POS trigger propagates
-- these corrected values to clientes_proveedores in the same transaction.
update public.clientes_crm c
set
  email = lower(btrim(c.direccion)),
  direccion = null
where nullif(btrim(c.email), '') is null
  and c.direccion ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  and not exists (
    select 1
    from public.clientes_crm existing
    where existing.id_empresa = c.id_empresa
      and existing.id <> c.id
      and lower(existing.email) = lower(btrim(c.direccion))
  );

update public.clientes_crm
set codigo = 'CLI-' || lpad(id::text, 6, '0')
where nullif(btrim(codigo), '') is null;

alter table public.clientes_crm
  alter column codigo set not null;

comment on column public.clientes_crm.codigo is
  'Código operativo estable generado como CLI-000001 para búsqueda, asistencia y atención.';
