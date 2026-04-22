import Stripe from "npm:stripe@18.4.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsPreflight, generateAccessCode, json } from "../_shared/utils.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-01-27.acac"
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

    const { sessionId } = await req.json();
    if (!sessionId) return json({ error: "Missing sessionId" }, 400);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid =
      session.payment_status === "paid" ||
      session.payment_status === "no_payment_required";
    if (!paid) return json({ success: false, message: "Payment not completed" }, 400);

    const metaUserId = session.metadata?.userId || null;
    const refUserId = session.client_reference_id || null;
    const sessionUserId = metaUserId || refUserId;
    if (!sessionUserId || sessionUserId !== authData.user.id) {
      return json({ success: false, message: "Session mismatch" }, 403);
    }

    // Subscription checkout (pricing page) — no course row in checkout_sessions.
    if (session.mode === "subscription") {
      const cust = session.customer;
      const stripeCustomerId =
        typeof cust === "string" ? cust : cust && typeof cust === "object" && "id" in cust ? String((cust as { id: string }).id) : null;
      const sub = session.subscription;
      const stripeSubscriptionId =
        typeof sub === "string" ? sub : sub && typeof sub === "object" && "id" in sub ? String((sub as { id: string }).id) : null;

      await supabase
        .from("users")
        .update({
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          subscription_tier: session.metadata?.planId || null,
          subscription_status: "active",
          subscription_period: session.metadata?.isAnnual === "true" ? "annual" : "monthly"
        })
        .eq("id", authData.user.id);

      return json({
        success: true,
        kind: "subscription",
        accessCode: "",
        qrUrl: ""
      });
    }

    const { data: checkout } = await supabase.from("checkout_sessions").select("*").eq("id", sessionId).single();
    if (!checkout) return json({ error: "Checkout session not found" }, 404);

    if (checkout.status === "processed" && checkout.enrollment_id) {
      const { data: existing } = await supabase
        .from("course_enrollments")
        .select("access_code, qr_url")
        .eq("id", checkout.enrollment_id)
        .single();
      if (existing) return json({ success: true, accessCode: existing.access_code, qrUrl: existing.qr_url });
    }

    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("*")
      .eq("id", checkout.course_id)
      .single();
    if (courseErr || !course) return json({ error: "Course not found" }, 404);

    const accessCode = generateAccessCode();
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(accessCode)}`;
    const enrollmentId = `${Date.now()}_${authData.user.id}`;
    const applicant = checkout.course_applicant_data || {};

    const { error: enrollErr } = await supabase.from("course_enrollments").insert({
      id: enrollmentId,
      user_id: authData.user.id,
      email: authData.user.email,
      course_id: checkout.course_id,
      course: course.title,
      price: course.price,
      payment_status: "paid",
      payment_provider: "stripe",
      stripe_session_id: sessionId,
      first_name: applicant.firstName || null,
      last_name: applicant.lastName || null,
      age: applicant.age || null,
      country: applicant.country || null,
      education: applicant.education || null,
      professional: applicant.professional || null,
      motivation: applicant.motivation || null,
      access_code: accessCode,
      qr_url: qrUrl,
      session_date: course.next_session
    });
    if (enrollErr) return json({ error: enrollErr.message }, 500);

    await supabase.from("checkout_sessions").update({
      status: "processed",
      enrollment_id: enrollmentId,
      processed_at: new Date().toISOString()
    }).eq("id", sessionId);

    return json({ success: true, accessCode, qrUrl });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
