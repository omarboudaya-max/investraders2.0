import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsPreflight, generateAccessCode, json } from "../_shared/utils.ts";

async function getPayPalAccessToken() {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID") || "";
  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET") || "";
  const env = (Deno.env.get("PAYPAL_ENV") || "sandbox").toLowerCase();
  const base = env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const auth = btoa(`${clientId}:${secret}`);
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = await res.json();
  return { token: data.access_token as string, base };
}

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

    const { orderID, courseApplicantData, courseId } = await req.json();
    if (!orderID || !courseId) return json({ error: "Missing orderID or courseId" }, 400);

    const { data: course, error: courseErr } = await supabase.from("courses").select("*").eq("id", courseId).single();
    if (courseErr || !course) return json({ error: "Course not found" }, 404);

    const { token: ppToken, base } = await getPayPalAccessToken();
    const captureRes = await fetch(`${base}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ppToken}`,
        "Content-Type": "application/json"
      },
      body: "{}"
    });
    if (!captureRes.ok) return json({ success: false, message: `Capture failed: ${captureRes.status}` }, 400);

    const capture = await captureRes.json();
    if (capture.status !== "COMPLETED") return json({ success: false, message: "Payment not completed" }, 400);

    const accessCode = generateAccessCode();
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(accessCode)}`;
    const enrollmentId = `${Date.now()}_${authData.user.id}`;
    const applicant = courseApplicantData || {};

    const { error: enrollErr } = await supabase.from("course_enrollments").insert({
      id: enrollmentId,
      user_id: authData.user.id,
      email: authData.user.email,
      course_id: courseId,
      course: course.title,
      price: course.price,
      payment_status: "paid",
      payment_provider: "paypal",
      paypal_order_id: orderID,
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

    return json({ success: true, accessCode, qrUrl });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
