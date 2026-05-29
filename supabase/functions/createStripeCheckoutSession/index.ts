import Stripe from "stripe";
import { handleSafe, json, checkRateLimit, validateFields, getCached, setCached, logger } from "../_shared/utils.ts";

Deno.serve(async (req: Request) => {
  return handleSafe(req, async (req, supabase) => {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    // 1. Rate Limiting (10 requests per 60 seconds)
    const rateLimit = await checkRateLimit(req, 'create_stripe_session', 10, 60);
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
      courseId: { type: "string", required: true, min: 3, max: 100 }
    });
    if (!validation.isValid) {
      return json({ error: "Validation failed", details: validation.errors }, 400);
    }

    const { courseId, courseApplicantData } = body;

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

    // 4. Smart caching for courses (5 minutes TTL)
    const cacheKey = `course:${courseId}`;
    let course = getCached<any>(cacheKey);
    if (!course) {
      logger.info(`Cache miss: fetching course ${courseId} from DB`);
      const { data, error: courseErr } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();
      if (courseErr || !data) return json({ error: "Course not found" }, 404);
      course = data;
      setCached(cacheKey, course, 300);
    } else {
      logger.info(`Cache hit: course ${courseId}`);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-01-27.acacia"
    });

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
  });
});
