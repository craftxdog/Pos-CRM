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
      .select("role, tenants(stripe_customer_id)")
      .eq("user_id", authData.user.id)
      .eq("estado", "active")
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "Tenant administrator access required" }, 403);

    const customerId = membership.tenants?.stripe_customer_id;
    if (!customerId) return json({ error: "Tenant has no Stripe customer" }, 422);

    const appUrl = requiredEnv("APP_URL").replace(/\/$/, "");
    const values = new URLSearchParams({ customer: customerId, return_url: `${appUrl}/configuraciones` });
    const stripeResponse = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredEnv("STRIPE_SECRET_KEY")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: values,
    });
    const session = await stripeResponse.json();
    if (!stripeResponse.ok) throw new Error(session?.error?.message || "Stripe request failed");
    return json({ url: session.url });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
