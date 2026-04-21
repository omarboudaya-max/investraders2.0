import Stripe from "npm:stripe@18.4.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsPreflight, json } from "../_shared/utils.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-01-27.acac"
});

const PLANS = {
  starter: { name: "Starter Plan", monthly: 29, annual: 23 },
  pro: { name: "Pro Plan", monthly: 79, annual: 63 },
  venture: { name: "Venture Plan", monthly: 249, annual: 199 }
};

Deno.serve(async (req: Request) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing auth token" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SERVICE_ROLE_KEY") || ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData.user) return json({ error: "Invalid auth token" }, 401);

    const { planId, isAnnual } = await req.json();
    const plan = PLANS[planId as keyof typeof PLANS];
    if (!plan) return json({ error: "Invalid plan ID" }, 400);

    const unitAmount = isAnnual ? plan.annual * 100 : plan.monthly * 100;
    const interval = isAnnual ? "year" : "month";
    const origin = req.headers.get("origin") || Deno.env.get("APP_ORIGIN") || "https://www.investraders.net";

    // 1. Check if user already has a stripe_customer_id
    const { data: userData } = await supabase
      .from("users")
      .select("stripe_customer_id")
      .eq("id", authData.user.id)
      .single();

    let customerId = userData?.stripe_customer_id;

    // 2. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId || undefined,
      customer_email: customerId ? undefined : authData.user.email,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Investrade ${plan.name} (${isAnnual ? "Annual" : "Monthly"})`,
              description: `Subscription for ${plan.name} billed ${isAnnual ? "annually" : "monthly"}.`
            },
            unit_amount: unitAmount,
            recurring: {
              interval: "month", // Even annual plans in dynamic price_data use interval 'month' with interval_count or 'year'
              interval_count: isAnnual ? 12 : 1 // Wait, mode subscription recurring allows 'year' too
            }
          },
          quantity: 1,
        },
      ],
      // Correcting recurring: 'year' is valid
      ...(isAnnual ? { 
        line_items: [{ 
          price_data: { 
            currency: "usd", 
            product_data: { name: `Investrade ${plan.name} (Annual)` }, 
            unit_amount: unitAmount * 12, // User said $23/mo billed annually
            recurring: { interval: "year" } 
          }, 
          quantity: 1 
        }]
      } : {}),
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      metadata: {
        userId: authData.user.id,
        planId: planId,
        isAnnual: String(isAnnual)
      }
    });

    return json({ url: session.url });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
