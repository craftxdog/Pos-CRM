-- The row trigger runs as the authenticated caller and invokes this nested
-- SECURITY INVOKER helper. RLS still limits the UPDATE to the caller's tenant.
revoke all on function private.recalculate_sale_totals(bigint) from public, anon;
grant execute on function private.recalculate_sale_totals(bigint) to authenticated;
