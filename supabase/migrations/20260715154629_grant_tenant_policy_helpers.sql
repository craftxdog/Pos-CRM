-- RLS expressions execute with the caller's privileges. These private helpers
-- expose only the caller's tenant UUID or a boolean entitlement decision and
-- validate auth.uid() internally; authenticated needs EXECUTE for policies to run.
grant usage on schema private to authenticated;
grant execute on function private.current_tenant_id() to authenticated;
grant execute on function private.tenant_has_feature(uuid, text) to authenticated;
grant execute on function private.is_tenant_admin(uuid) to authenticated;

revoke usage on schema private from anon;
revoke execute on function private.current_tenant_id() from anon;
revoke execute on function private.tenant_has_feature(uuid, text) from anon;
revoke execute on function private.is_tenant_admin(uuid) from anon;

notify pgrst, 'reload schema';
