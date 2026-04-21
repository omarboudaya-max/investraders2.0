import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsPreflight, json } from "../_shared/utils.ts";

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

Deno.serve(async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { courseId } = await req.json();
    if (!courseId) return json({ error: "Missing courseId" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SERVICE_ROLE_KEY") || ""
    );
    const { data: course, error: courseErr } = await supabase.from("courses").select("*").eq("id", courseId).single();
    if (courseErr || !course) return json({ error: "Course not found" }, 404);

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
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
