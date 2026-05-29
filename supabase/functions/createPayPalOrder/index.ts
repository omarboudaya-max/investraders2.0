import { handleSafe, json, checkRateLimit, validateFields, getCached, setCached, logger } from "../_shared/utils.ts";

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

    // 1. Rate Limiting (10 requests per 60 seconds)
    const rateLimit = await checkRateLimit(req, 'create_paypal_order', 10, 60);
    if (!rateLimit.allowed) {
      return json({ error: `Too many requests. Please try again in ${rateLimit.reset} seconds.` }, 429);
    }

    // 2. Input Validation
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const validation = validateFields(body, {
      courseId: { type: "string", required: true, min: 3, max: 100 }
    });
    if (!validation.isValid) {
      return json({ error: "Validation failed", details: validation.errors }, 400);
    }

    const { courseId } = body;

    // 3. Smart Caching for course details (TTL 5 minutes)
    const cacheKey = `course:${courseId}`;
    let course = getCached<any>(cacheKey);

    if (!course) {
      logger.info(`Cache miss: fetching course ${courseId} from DB`);
      const { data, error: courseErr } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();

      if (courseErr || !data) {
        return json({ error: "Course not found" }, 404);
      }
      course = data;
      setCached(cacheKey, course, 300); // 5 minutes TTL
    } else {
      logger.info(`Cache hit: course ${courseId}`);
    }

    const { token, base } = await getPayPalAccessToken();
    const createRes = await fetch(`${base}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            description: course.title,
            amount: {
              currency_code: "USD",
              value: Number(course.price).toFixed(2)
            }
          }
        ]
      })
    });
    if (!createRes.ok) return json({ error: `PayPal create order failed: ${createRes.status}` }, 500);
    const order = await createRes.json();
    return json({ id: order.id });
  });
});
