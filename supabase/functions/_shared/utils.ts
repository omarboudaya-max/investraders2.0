import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
}

export function corsPreflight(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    });
  }
  return null;
}

export function generateAccessCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segment = () =>
    Array.from({ length: 4 })
      .map(() => chars[Math.floor(Math.random() * chars.length)])
      .join("");
  return `INVEST-${segment()}-${segment()}`;
}

// ── Structured Logger ──
export const logger = {
  info: (message: string, context?: any) => {
    console.log(
      JSON.stringify({
        level: "INFO",
        message,
        context,
        timestamp: new Date().toISOString()
      })
    );
  },
  warn: (message: string, context?: any) => {
    console.warn(
      JSON.stringify({
        level: "WARN",
        message,
        context,
        timestamp: new Date().toISOString()
      })
    );
  },
  error: (message: string, error?: any, context?: any) => {
    console.error(
      JSON.stringify({
        level: "ERROR",
        message,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context,
        timestamp: new Date().toISOString()
      })
    );
  }
};

// ── Rate Limiter ──
export async function checkRateLimit(
  req: Request,
  action: string,
  limitCount: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    logger.warn("Supabase credentials missing during rate limit check");
    return { allowed: true, remaining: limitCount, reset: 0 };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Get client IP address
  const ip = req.headers.get("x-real-ip") || 
             req.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
             "unknown-ip";

  // Check if authenticated
  let userId = "anonymous";
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabase.auth.getUser(token);
    if (data?.user) {
      userId = data.user.id;
    }
  }

  const identifier = userId !== "anonymous" ? userId : ip;
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);

  try {
    // In-line cleanup of old logs for this action/identifier
    await supabase
      .from("rate_limits")
      .delete()
      .lt("timestamp", windowStart.toISOString());

    // Count hits in current window
    const { data, error } = await supabase
      .from("rate_limits")
      .select("id")
      .eq("identifier", identifier)
      .eq("action", action)
      .gte("timestamp", windowStart.toISOString());

    if (error) {
      logger.error("Rate limit database check failed", error);
      return { allowed: true, remaining: limitCount, reset: 0 };
    }

    const currentCount = data?.length || 0;

    if (currentCount >= limitCount) {
      const resetTime = Math.max(1, Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000));
      return { allowed: false, remaining: 0, reset: resetTime };
    }

    // Insert rate limit hit
    await supabase.from("rate_limits").insert({
      identifier,
      action,
      timestamp: now.toISOString()
    });

    return {
      allowed: true,
      remaining: limitCount - currentCount - 1,
      reset: windowSeconds
    };
  } catch (err) {
    logger.error("Rate limiting logic failed", err);
    return { allowed: true, remaining: limitCount, reset: 0 };
  }
}

// ── Input Validation ──
export interface ValidationRule {
  type: "string" | "number" | "email" | "boolean";
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
}

export function validateFields(
  data: any,
  schema: Record<string, ValidationRule>
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const [field, rules] of Object.entries(schema)) {
    const val = data?.[field];

    if (rules.required && (val === undefined || val === null || val === "")) {
      errors[field] = `${field} is required`;
      continue;
    }

    if (val !== undefined && val !== null && val !== "") {
      if (rules.type === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(val))) {
          errors[field] = `Invalid email format`;
        }
      } else if (rules.type === "number") {
        if (isNaN(Number(val))) {
          errors[field] = `${field} must be a number`;
        } else {
          const num = Number(val);
          if (rules.min !== undefined && num < rules.min) errors[field] = `${field} must be at least ${rules.min}`;
          if (rules.max !== undefined && num > rules.max) errors[field] = `${field} must be at most ${rules.max}`;
        }
      } else if (rules.type === "string") {
        const str = String(val);
        if (rules.min !== undefined && str.length < rules.min) errors[field] = `${field} must be at least ${rules.min} characters`;
        if (rules.max !== undefined && str.length > rules.max) errors[field] = `${field} must be at most ${rules.max} characters`;
        if (rules.pattern && !rules.pattern.test(str)) errors[field] = `${field} format is invalid`;
      } else if (rules.type === "boolean") {
        if (typeof val !== "boolean" && val !== "true" && val !== "false") {
          errors[field] = `${field} must be a boolean`;
        }
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// ── Deno Local Cache ──
const localCache = new Map<string, { data: any; expiresAt: number }>();

export function getCached<T>(key: string): T | null {
  const cached = localCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    localCache.delete(key);
    return null;
  }
  return cached.data as T;
}

export function setCached<T>(key: string, data: T, ttlSeconds: number): void {
  localCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
}

// ── handleSafe Middleware ──
export async function handleSafe(
  req: Request,
  handler: (req: Request, supabase: any) => Promise<Response>
): Promise<Response> {
  const start = Date.now();
  const method = req.method;
  const url = req.url;

  logger.info(`Request started`, { method, url });

  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const response = await handler(req, supabase);
    const duration = Date.now() - start;

    logger.info(`Request completed`, { method, url, status: response.status, durationMs: duration });
    return response;
  } catch (err) {
    const duration = Date.now() - start;
    logger.error(`Request failed`, err, { method, url, durationMs: duration });
    return json({ error: (err as Error).message }, 500);
  }
}
