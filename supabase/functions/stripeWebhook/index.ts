import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { json } from "../_shared/utils.ts";



Deno.serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return json({ error: "Missing signature" }, 400);

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-01-27.acacia"
    });
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
        const userId = session.metadata?.userId || session.client_reference_id;
        
        if (!userId) {
          console.error("No userId or client_reference_id found in session");
          break;
        }

        if (session.mode === "subscription") {
          const planId = session.metadata?.planId || "starter";
          const isAnnual = session.metadata?.isAnnual === "true";
          
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
        } else if (session.mode === "payment") {
          // It's a Course Payment Link
          const { generateAccessCode } = await import("../_shared/utils.ts");
          const accessCode = generateAccessCode();
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(accessCode)}`;
          const enrollmentId = `${Date.now()}_${userId}`;
          
          const { error: enrollErr } = await supabase.from("course_enrollments").insert({
            id: enrollmentId,
            user_id: userId,
            email: session.customer_details?.email || null,
            course_id: "how-to-build-startup-with-ai",
            course: "How to Build Your Startup Using AI",
            price: (session.amount_total || 30000) / 100,
            payment_status: "paid",
            payment_provider: "stripe",
            stripe_session_id: session.id,
            access_code: accessCode,
            qr_url: qrUrl,
            session_date: "15 August 2026"
          });
          
          if (enrollErr) {
            console.error("Enrollment insert error:", enrollErr.message);
          }
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
