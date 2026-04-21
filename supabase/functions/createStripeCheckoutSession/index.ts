import Stripe from "npm:stripe@18.4.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsPreflight, json } from "../_shared/utils.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-03-31.basil"
});

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

    const { courseId, courseApplicantData } = await req.json();
    if (!courseId) return json({ error: "Missing courseId" }, 400);

    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .single();
    if (courseErr || !course) return json({ error: "Course not found" }, 404);

    const origin = req.headers.get("origin") || Deno.env.get("APP_ORIGIN") || "http://localhost:5173";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: authData.user.email,
      client_reference_id: authData.user.id,
      success_url: `${origin}/?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?stripe=cancelled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(Number(course.price) * 100),
            product_data: {
              name: course.title,
              description: course.description
            }
          }
        }
      ],
      metadata: {
        courseId: course.id,
        userId: authData.user.id
      }
    });

    const { error: saveErr } = await supabase.from("checkout_sessions").upsert({
      id: session.id,
      user_id: authData.user.id,
      email: authData.user.email,
      course_id: course.id,
      provider: "stripe",
      status: "created",
      course_applicant_data: courseApplicantData || {}
    });
    if (saveErr) return json({ error: saveErr.message }, 500);

    return json({ id: session.id, url: session.url });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
