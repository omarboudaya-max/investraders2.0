import { handleSafe, json, checkRateLimit, validateFields, generateAccessCode, logger } from "../_shared/utils.ts";

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
  return handleSafe(req, async (req, supabase) => {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    // 1. Rate Limiting (15 requests per 60 seconds)
    const rateLimit = await checkRateLimit(req, 'capture_paypal_order', 15, 60);
    if (!rateLimit.allowed) {
      return json({ error: `Too many requests. Please try again in ${rateLimit.reset} seconds.` }, 429);
    }

    // 2. Auth check (requires valid Bearer token)
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
      orderID: { type: "string", required: true, min: 3, max: 100 },
      courseId: { type: "string", required: true, min: 3, max: 100 }
    });
    if (!validation.isValid) {
      return json({ error: "Validation failed", details: validation.errors }, 400);
    }

    const { orderID, courseId, courseApplicantData } = body;

    // Validate optional applicant data if present
    if (courseApplicantData) {
      const appValidation = validateFields(courseApplicantData, {
        firstName: { type: "string", required: true, min: 1, max: 100 },
        lastName: { type: "string", required: true, min: 1, max: 100 },
        email: { type: "email", required: true },
        age: { type: "string", required: true },
        country: { type: "string", required: true },
        education: { type: "string", required: true },
        professional: { type: "string", required: true }
      });
      if (!appValidation.isValid) {
        return json({ error: "Applicant validation failed", details: appValidation.errors }, 400);
      }
    }

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

    logger.info(`Successfully enrolled user ${authData.user.id} in course ${courseId} via PayPal`);
    return json({ success: true, accessCode, qrUrl });
  });
});
