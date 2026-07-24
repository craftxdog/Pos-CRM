-- Auditoría de solo lectura para el esquema expuesto de ActiveSelfControl.
-- Devuelve un único documento JSON para facilitar comparación antes/después.
select jsonb_pretty(jsonb_build_object(
  'server', jsonb_build_object(
    'version', current_setting('server_version'),
    'database', current_database(),
    'role', current_user,
    'captured_at', clock_timestamp()
  ),
  'relations', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'name', c.relname,
      'kind', c.relkind,
      'rows_estimate', c.reltuples::bigint,
      'rls', c.relrowsecurity,
      'force_rls', c.relforcerowsecurity
    ) order by n.nspname, c.relname), '[]'::jsonb)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'storage')
      and c.relkind in ('r', 'p', 'v', 'm')
  ),
  'tables_without_primary_key', (
    select coalesce(jsonb_agg(format('%I.%I', n.nspname, c.relname) order by 1), '[]'::jsonb)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not exists (
        select 1 from pg_constraint con
        where con.conrelid = c.oid and con.contype = 'p'
      )
  ),
  'invalid_indexes', (
    select coalesce(jsonb_agg(format('%I.%I', n.nspname, i.relname) order by 1), '[]'::jsonb)
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
    join pg_class t on t.oid = x.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and not x.indisvalid
  ),
  'foreign_keys_without_covering_index', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', con.conrelid::regclass::text,
      'constraint', con.conname,
      'columns', con.conkey
    ) order by con.conrelid::regclass::text, con.conname), '[]'::jsonb)
    from pg_constraint con
    where con.contype = 'f'
      and con.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index idx
        where idx.indrelid = con.conrelid
          and idx.indisvalid
          and idx.indpred is null
          and (idx.indkey::smallint[])[0:cardinality(con.conkey)-1] = con.conkey
      )
  ),
  'rls_tables_without_policies', (
    select coalesce(jsonb_agg(format('%I.%I', n.nspname, c.relname) order by 1), '[]'::jsonb)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
  ),
  'public_tables_without_rls', (
    select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  ),
  'policies', (
    select coalesce(jsonb_agg(to_jsonb(p) order by p.schemaname, p.tablename, p.policyname), '[]'::jsonb)
    from pg_policies p where p.schemaname in ('public', 'storage')
  ),
  'views', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', format('%I.%I', n.nspname, c.relname),
      'security_invoker', coalesce(array_position(c.reloptions, 'security_invoker=true') is not null, false),
      'owner', pg_get_userbyid(c.relowner)
    ) order by c.relname), '[]'::jsonb)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
  ),
  'functions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'identity', p.oid::regprocedure::text,
      'language', l.lanname,
      'security_definer', p.prosecdef,
      'volatility', p.provolatile,
      'parallel', p.proparallel,
      'config', p.proconfig,
      'owner', pg_get_userbyid(p.proowner),
      'public_execute', has_function_privilege('public', p.oid, 'execute'),
      'anon_execute', has_function_privilege('anon', p.oid, 'execute'),
      'authenticated_execute', has_function_privilege('authenticated', p.oid, 'execute')
    ) order by p.proname, p.oid::regprocedure::text), '[]'::jsonb)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
  ),
  'triggers', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', t.tgrelid::regclass::text,
      'name', t.tgname,
      'enabled', t.tgenabled,
      'function', t.tgfoid::regprocedure::text
    ) order by t.tgrelid::regclass::text, t.tgname), '[]'::jsonb)
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
  ),
  'extensions', (
    select coalesce(jsonb_agg(jsonb_build_object('name', extname, 'version', extversion) order by extname), '[]'::jsonb)
    from pg_extension
  ),
  'grants_to_api_roles', (
    select coalesce(jsonb_agg(to_jsonb(g) order by g.table_schema, g.table_name, g.grantee, g.privilege_type), '[]'::jsonb)
    from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated')
  )
));
