import Stripe from "npm:stripe@18.4.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { json } from "../_shared/utils.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-01-27.acac"
});

Deno.serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return json({ error: "Missing signature" }, 400);

  try {
    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    let event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret || "");
    } catch (err) {
      console.error(`Webhook signature verification failed: ${(err as Error).message}`);
      return json({ error: "Invalid signature" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SERVICE_ROLE_KEY") || ""
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId;
        const isAnnual = session.metadata?.isAnnual === "true";

        if (userId) {
          await supabase
            .from("users")
            .update({
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              subscription_tier: planId,
              subscription_status: "active",
              subscription_period: isAnnual ? "annual" : "monthly"
            })
            .eq("id", userId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await supabase
          .from("users")
          .update({
            subscription_status: subscription.status,
            subscription_tier: subscription.items.data[0].price.metadata?.planId || undefined
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await supabase
          .from("users")
          .update({
            subscription_status: "canceled",
            subscription_tier: "free"
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }
    }

    return json({ received: true });
  } catch (err) {
    console.error(`Webhook error: ${(err as Error).message}`);
    return json({ error: "Internal server error" }, 500);
  }
});
