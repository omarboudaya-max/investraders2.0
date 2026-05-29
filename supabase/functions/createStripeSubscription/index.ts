import Stripe from "stripe";
import { handleSafe, json, checkRateLimit, validateFields, logger } from "../_shared/utils.ts";

const PLANS = {
  starter: { name: "Starter Plan", monthly: 29, annual: 23 },
  pro: { name: "Pro Plan", monthly: 79, annual: 63 },
  venture: { name: "Venture Plan", monthly: 249, annual: 199 }
};

Deno.serve(async (req: Request) => {
  return handleSafe(req, async (req, supabase) => {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    // 1. Rate Limiting (10 requests per 60 seconds)
    const rateLimit = await checkRateLimit(req, 'create_stripe_sub', 10, 60);
    if (!rateLimit.allowed) {
      return json({ error: `Too many requests. Please try again in ${rateLimit.reset} seconds.` }, 429);
    }

    // 2. Auth check
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing auth token" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData.user) return json({ error: "Invalid auth token" }, 401);

    // 3. Input Validation
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const validation = validateFields(body, {
      planId: { type: "string", required: true, min: 3, max: 20 },
      isAnnual: { type: "boolean", required: true }
    });
    if (!validation.isValid) {
      return json({ error: "Validation failed", details: validation.errors }, 400);
    }

    const { planId, isAnnual } = body;
    const plan = PLANS[planId as keyof typeof PLANS];
    if (!plan) return json({ error: "Invalid plan ID" }, 400);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-01-27.acacia"
    });

    const origin = req.headers.get("origin") || Deno.env.get("APP_ORIGIN") || "https://www.investraders.net";

    // 4. Fetch stripe_customer_id
    const { data: userData } = await supabase
      .from("users")
      .select("stripe_customer_id")
      .eq("id", authData.user.id)
      .single();

    const customerId = userData?.stripe_customer_id;

    const lineItems = isAnnual
      ? [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              product_data: {
                name: `Investrade ${plan.name} (Annual)`,
                description: `Billed once per year (${plan.annual}/mo equivalent).`
              },
              unit_amount: Math.round(plan.annual * 12 * 100),
              recurring: { interval: "year" as const }
            }
          }
        ]
      : [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              product_data: {
                name: `Investrade ${plan.name} (Monthly)`,
                description: `Billed every month.`
              },
              unit_amount: Math.round(plan.monthly * 100),
              recurring: { interval: "month" as const }
            }
          }
        ];

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: authData.user.id,
      customer: customerId || undefined,
      customer_email: customerId ? undefined : authData.user.email || undefined,
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}&type=subscription`,
      cancel_url: `${origin}/?checkout=cancelled`,
      metadata: {
        userId: authData.user.id,
        planId: planId,
        isAnnual: String(isAnnual)
      }
    });

    logger.info(`Stripe subscription session created for user ${authData.user.id}, session ${session.id}`);
    return json({ url: session.url });
  });
});
