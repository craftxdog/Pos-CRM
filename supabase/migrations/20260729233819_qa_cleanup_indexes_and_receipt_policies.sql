-- Keep the original FK-supporting index and remove the duplicate introduced
-- while correcting the POS customer relationship.
drop index if exists public.ventas_id_cliente_idx;

-- Split the former FOR ALL policy so SELECT evaluates only the dedicated
-- company policy. UPDATE still has both USING and WITH CHECK protection.
drop policy if exists "crm_comprobantes_cobro_company_write"
on public.crm_comprobantes_cobro;

drop policy if exists "crm_comprobantes_cobro_company_insert"
on public.crm_comprobantes_cobro;
create policy "crm_comprobantes_cobro_company_insert"
on public.crm_comprobantes_cobro
for insert
to authenticated
with check (id_empresa = (select private.current_empresa_id()));

drop policy if exists "crm_comprobantes_cobro_company_update"
on public.crm_comprobantes_cobro;
create policy "crm_comprobantes_cobro_company_update"
on public.crm_comprobantes_cobro
for update
to authenticated
using (id_empresa = (select private.current_empresa_id()))
with check (id_empresa = (select private.current_empresa_id()));

drop policy if exists "crm_comprobantes_cobro_company_delete"
on public.crm_comprobantes_cobro;
create policy "crm_comprobantes_cobro_company_delete"
on public.crm_comprobantes_cobro
for delete
to authenticated
using (id_empresa = (select private.current_empresa_id()));
