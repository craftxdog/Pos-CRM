import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function stripeRequest(path: string, values: URLSearchParams) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: values,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || "Stripe request failed");
  return result;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anon = createClient(supabaseUrl, requiredEnv("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await anon.auth.getUser();
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });
    const { data: membership, error: membershipError } = await admin
      .from("tenant_memberships")
      .select("tenant_id, role, tenants(stripe_customer_id)")
      .eq("user_id", authData.user.id)
      .eq("estado", "active")
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "Tenant administrator access required" }, 403);

    const payload = await request.json().catch(() => ({}));
    const planId = typeof payload.plan_id === "string" ? payload.plan_id : "";
    const { data: plan, error: planError } = await admin
      .from("saas_plans")
      .select("id, stripe_price_id")
      .eq("id", planId)
      .eq("activo", true)
      .maybeSingle();
    if (planError) throw planError;
    if (!plan?.stripe_price_id) return json({ error: "Plan is not configured for Stripe" }, 422);

    const appUrl = requiredEnv("APP_URL").replace(/\/$/, "");
    const tenantId = membership.tenant_id;
    const values = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": plan.stripe_price_id,
      "line_items[0][quantity]": "1",
      client_reference_id: tenantId,
      "metadata[tenant_id]": tenantId,
      "metadata[plan_id]": plan.id,
      "subscription_data[metadata][tenant_id]": tenantId,
      "subscription_data[metadata][plan_id]": plan.id,
      success_url: `${appUrl}/configuraciones?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/configuraciones?billing=canceled`,
      allow_promotion_codes: "true",
    });
    const stripeCustomerId = membership.tenants?.stripe_customer_id;
    if (stripeCustomerId) values.set("customer", stripeCustomerId);
    else if (authData.user.email) values.set("customer_email", authData.user.email);

    const session = await stripeRequest("checkout/sessions", values);
    return json({ id: session.id, url: session.url });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
