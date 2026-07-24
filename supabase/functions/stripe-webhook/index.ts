import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const encoder = new TextEncoder();

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

async function verifyStripeSignature(rawBody: string, signature: string, secret: string) {
  const values = signature.split(",").reduce<Record<string, string[]>>((result, part) => {
    const [key, value] = part.split("=", 2);
    if (key && value) (result[key] ||= []).push(value);
    return result;
  }, {});
  const timestamp = Number(values.t?.[0]);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = bytesToHex(
    await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`))
  );
  return (values.v1 || []).some((candidate) => timingSafeEqual(digest, candidate));
}

function toIso(unixSeconds?: number | null) {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return response({ error: "Stripe webhook is not configured" }, 503);
  }
  if (!(await verifyStripeSignature(rawBody, signature, webhookSecret))) {
    return response({ error: "Invalid Stripe signature" }, 400);
  }

  const event = JSON.parse(rawBody);
  const admin = createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );

  const { error: eventInsertError } = await admin.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event,
  });
  if (eventInsertError?.code === "23505") return response({ received: true, duplicate: true });
  if (eventInsertError) return response({ error: eventInsertError.message }, 500);

  try {
    const object = event.data?.object || {};

    if (event.type === "checkout.session.completed") {
      const tenantId = object.metadata?.tenant_id || object.client_reference_id;
      if (!tenantId) throw new Error("Checkout session is missing tenant_id metadata");
      const { error } = await admin
        .from("tenants")
        .update({ stripe_customer_id: object.customer, updated_at: new Date().toISOString() })
        .eq("id", tenantId);
      if (error) throw error;
    }

    if (event.type.startsWith("customer.subscription.")) {
      const stripePriceId = object.items?.data?.[0]?.price?.id;
      const { data: tenant, error: tenantError } = await admin
        .from("tenants")
        .select("id")
        .or(
          object.metadata?.tenant_id
            ? `id.eq.${object.metadata.tenant_id},stripe_customer_id.eq.${object.customer}`
            : `stripe_customer_id.eq.${object.customer}`
        )
        .maybeSingle();
      if (tenantError) throw tenantError;
      if (!tenant) throw new Error("Stripe customer is not linked to a tenant");

      const { data: plan, error: planError } = await admin
        .from("saas_plans")
        .select("id")
        .eq("stripe_price_id", stripePriceId)
        .maybeSingle();
      if (planError) throw planError;
      if (!plan) throw new Error(`No SaaS plan is linked to Stripe price ${stripePriceId}`);

      const status = event.type === "customer.subscription.deleted" ? "canceled" : object.status;
      await admin
        .from("tenant_subscriptions")
        .update({ estado: "canceled", canceled_at: new Date().toISOString() })
        .eq("tenant_id", tenant.id)
        .neq("stripe_subscription_id", object.id)
        .in("estado", ["trialing", "active", "past_due", "unpaid", "incomplete", "paused"]);

      const { error: subscriptionError } = await admin
        .from("tenant_subscriptions")
        .upsert(
          {
            tenant_id: tenant.id,
            plan_id: plan.id,
            stripe_subscription_id: object.id,
            stripe_price_id: stripePriceId,
            estado: status,
            cancel_at_period_end: Boolean(object.cancel_at_period_end),
            current_period_start: toIso(object.current_period_start),
            current_period_end: toIso(object.current_period_end),
            canceled_at: toIso(object.canceled_at),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "stripe_subscription_id" }
        );
      if (subscriptionError) throw subscriptionError;

      const tenantStatus = ["active", "trialing"].includes(status)
        ? status
        : status === "past_due" || status === "unpaid"
          ? "past_due"
          : "canceled";
      const { error: tenantUpdateError } = await admin
        .from("tenants")
        .update({
          stripe_customer_id: object.customer,
          estado: tenantStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenant.id);
      if (tenantUpdateError) throw tenantUpdateError;
    }

    if (["invoice.payment_failed", "invoice.payment_succeeded", "invoice.paid"].includes(event.type)) {
      const nextStatus = event.type === "invoice.payment_failed" ? "past_due" : "active";
      const { error } = await admin
        .from("tenant_subscriptions")
        .update({ estado: nextStatus, updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", object.subscription);
      if (error) throw error;
    }

    await admin
      .from("stripe_webhook_events")
      .update({ estado: "processed", processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);
    return response({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin
      .from("stripe_webhook_events")
      .update({ estado: "failed", error: message })
      .eq("stripe_event_id", event.id);
    return response({ error: message }, 500);
  }
});
