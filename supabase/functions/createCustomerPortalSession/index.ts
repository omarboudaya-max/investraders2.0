import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { corsPreflight, json } from "../_shared/utils.ts";



Deno.serve(async (req: Request) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-01-27.acacia"
    });
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing auth token" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SERVICE_ROLE_KEY") || ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData.user) return json({ error: "Invalid auth token" }, 401);

    // Fetch stripe_customer_id
    const { data: userData } = await supabase
      .from("users")
      .select("stripe_customer_id")
      .eq("id", authData.user.id)
      .single();

    if (!userData?.stripe_customer_id) {
      return json({ error: "No Stripe customer found for this user." }, 404);
    }

    const origin = req.headers.get("origin") || Deno.env.get("APP_ORIGIN") || "https://www.investraders.net";

    const session = await stripe.billingPortal.sessions.create({
      customer: userData.stripe_customer_id,
      return_url: `${origin}/dashboard`,
    });

    return json({ url: session.url });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
