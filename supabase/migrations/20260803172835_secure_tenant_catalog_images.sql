-- Catalog images are stored below the authenticated tenant path:
-- empresa/<company-id>/{categorias|metodospago}/<record-id>.
-- Keep the existing deterministic company-logo path working as well.
drop policy if exists imagenes_company_select on storage.objects;
drop policy if exists imagenes_company_insert on storage.objects;
drop policy if exists imagenes_company_update on storage.objects;
drop policy if exists imagenes_company_delete on storage.objects;

create policy imagenes_company_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'imagenes'
  and (
    name = ('empresa/' || (select private.current_empresa_id())::text)
    or name like (
      'empresa/' || (select private.current_empresa_id())::text || '/categorias/%'
    )
    or name like (
      'empresa/' || (select private.current_empresa_id())::text || '/metodospago/%'
    )
  )
);

create policy imagenes_company_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'imagenes'
  and (
    name = ('empresa/' || (select private.current_empresa_id())::text)
    or name like (
      'empresa/' || (select private.current_empresa_id())::text || '/categorias/%'
    )
    or name like (
      'empresa/' || (select private.current_empresa_id())::text || '/metodospago/%'
    )
  )
);

create policy imagenes_company_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'imagenes'
  and (
    name = ('empresa/' || (select private.current_empresa_id())::text)
    or name like (
      'empresa/' || (select private.current_empresa_id())::text || '/categorias/%'
    )
    or name like (
      'empresa/' || (select private.current_empresa_id())::text || '/metodospago/%'
    )
  )
)
with check (
  bucket_id = 'imagenes'
  and (
    name = ('empresa/' || (select private.current_empresa_id())::text)
    or name like (
      'empresa/' || (select private.current_empresa_id())::text || '/categorias/%'
    )
    or name like (
      'empresa/' || (select private.current_empresa_id())::text || '/metodospago/%'
    )
  )
);

create policy imagenes_company_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'imagenes'
  and (
    name = ('empresa/' || (select private.current_empresa_id())::text)
    or name like (
      'empresa/' || (select private.current_empresa_id())::text || '/categorias/%'
    )
    or name like (
      'empresa/' || (select private.current_empresa_id())::text || '/metodospago/%'
    )
  )
);
