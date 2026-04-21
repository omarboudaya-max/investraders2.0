const functions = require("firebase-functions");
const admin = require("firebase-admin");
const checkoutNodeJssdk = require("@paypal/checkout-server-sdk");
const Stripe = require("stripe");
const cors = require('cors')({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// Credentials are loaded from functions/.env as process.env variables.
// For local emulator: place them in functions/.env
// For production deploy: set them in functions/.env.production or via Secret Manager
//
// Switch paypal.env between "sandbox" (testing) and "live" (real payments).
const clientId     = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
const paypalEnv    = process.env.PAYPAL_ENV || "sandbox";

if (!clientId || !clientSecret) {
    console.error("❌ PayPal credentials missing. Check functions/.env file.");
}

const environment = paypalEnv === "live"
    ? new checkoutNodeJssdk.core.LiveEnvironment(clientId, clientSecret)
    : new checkoutNodeJssdk.core.SandboxEnvironment(clientId, clientSecret);

console.log(`ℹ️  PayPal running in ${paypalEnv.toUpperCase()} mode.`);
const client = new checkoutNodeJssdk.core.PayPalHttpClient(environment);

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

function getBearerToken(req) {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) return null;
    return authHeader.slice("Bearer ".length).trim();
}

function generateAccessCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const segment = () => {
        let res = "";
        for (let i = 0; i < 4; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
        return res;
    };
    return `INVEST-${segment()}-${segment()}`;
}

exports.createPayPalOrder = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        // Handle preflight
        if (req.method === 'OPTIONS') {
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Access-Control-Allow-Methods', 'GET, POST');
            res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.set('Access-Control-Max-Age', '3600');
            return res.status(204).send('');
        }

        try {
            const { courseId } = req.body;
            if (!courseId) throw new Error("Missing courseId");

            let courseSnap = await db.collection("courses").doc(courseId).get();
            
            // Auto-seed if missing
            if (!courseSnap.exists) {
                console.log(`Course ${courseId} missing. Auto-seeding...`);
                const defaultCourse = {
                    title: "How to Build Your Startup Using AI",
                    description: "Masterclass AI for Founders",
                    price: 300,
                    isActive: true
                };
                await db.collection("courses").doc(courseId).set(defaultCourse);
                courseSnap = await db.collection("courses").doc(courseId).get();
            }

            const courseData = courseSnap.data();

            const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
            request.prefer("return=representation");
            request.requestBody({
                intent: "CAPTURE",
                purchase_units: [
                    {
                        amount: {
                            currency_code: "USD",
                            value: courseData.price.toFixed(2),
                        },
                        description: courseData.title
                    },
                ],
            });

            const order = await client.execute(request);
            return res.status(200).json({ id: order.result.id });
        } catch (err) {
            console.error("Create Order Error:", err);
            return res.status(500).json({ error: err.message });
        }
    });
});

exports.capturePayPalOrder = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        // Handle preflight
        if (req.method === 'OPTIONS') {
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Access-Control-Allow-Methods', 'GET, POST');
            res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.set('Access-Control-Max-Age', '3600');
            return res.status(204).send('');
        }

        try {
            if (req.method !== "POST") {
                return res.status(405).json({ error: "Method not allowed" });
            }

            const token = getBearerToken(req);
            if (!token) {
                return res.status(401).json({ error: "Missing Authorization token" });
            }

            const decoded = await admin.auth().verifyIdToken(token);
            const authedUid = decoded.uid;
            const authedEmail = decoded.email || null;

            const { orderID, courseApplicantData, courseId } = req.body;
            if (!orderID) throw new Error("Missing orderID");
            if (!courseId) throw new Error("Missing courseId");

            const courseSnap = await db.collection("courses").doc(courseId).get();
            if (!courseSnap.exists) throw new Error("Course not found");
            const courseData = courseSnap.data();

            const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(orderID);
            request.requestBody({});
            
            const capture = await client.execute(request);
            
            // Only proceed if capture status is COMPLETED
            if (capture.result.status === 'COMPLETED') {
                const accessCode = generateAccessCode();
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(accessCode)}`;

                // Save to Firestore permanently inside a secure backend
                const safeEmail = (authedEmail || "no_email").replace(/[^a-zA-Z0-9]/g, "_");
                const docId = `${Date.now()}_${safeEmail}`;
                await db.collection("courseEnrollments").doc(docId).set({
                    ...courseApplicantData,
                    email: authedEmail,
                    userId: authedUid,
                    enrolledAt: new Date().toISOString(),
                    course: courseData.title,
                    courseId: courseId,
                    price: courseData.price,
                    paymentStatus: 'paid',
                    paymentProvider: 'paypal',
                    paypalOrderId: orderID,
                    accessCode: accessCode,
                    qrUrl: qrUrl,
                    sessionDate: courseData.nextSession
                });

                return res.status(200).json({ success: true, accessCode, qrUrl });
            } else {
                return res.status(400).json({ success: false, message: 'Payment not completed' });
            }

        } catch (err) {
            console.error("Capture Order Error:", err);
            return res.status(500).send(err.message);
        }
    });
});

exports.createStripeCheckoutSession = functions.runWith({ secrets: ["STRIPE_SECRET_KEY"] }).https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method === "OPTIONS") {
            res.set("Access-Control-Allow-Origin", "*");
            res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
            res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
            res.set("Access-Control-Max-Age", "3600");
            return res.status(204).send("");
        }

        try {
            if (!stripe) {
                return res.status(500).json({ error: "Stripe is not configured on the server" });
            }
            if (req.method !== "POST") {
                return res.status(405).json({ error: "Method not allowed" });
            }

            const token = getBearerToken(req);
            if (!token) {
                return res.status(401).json({ error: "Missing Authorization token" });
            }
            const decoded = await admin.auth().verifyIdToken(token);
            const authedUid = decoded.uid;
            const authedEmail = decoded.email || null;

            const { courseId, courseApplicantData } = req.body || {};
            if (!courseId) throw new Error("Missing courseId");

            const courseSnap = await db.collection("courses").doc(courseId).get();
            if (!courseSnap.exists) throw new Error("Course not found");
            const courseData = courseSnap.data();

            const origin = req.headers.origin || process.env.APP_ORIGIN || "https://www.investraders.net";
            const successUrl = `${origin}/?stripe=success&session_id={CHECKOUT_SESSION_ID}`;
            const cancelUrl = `${origin}/?stripe=cancelled`;

            const session = await stripe.checkout.sessions.create({
                mode: "payment",
                customer_email: authedEmail || undefined,
                client_reference_id: authedUid,
                success_url: successUrl,
                cancel_url: cancelUrl,
                line_items: [
                    {
                        quantity: 1,
                        price_data: {
                            currency: "usd",
                            product_data: {
                                name: courseData.title,
                                description: courseData.description || "Course enrollment"
                            },
                            unit_amount: Math.round(Number(courseData.price) * 100)
                        }
                    }
                ],
                metadata: {
                    courseId: courseId,
                    userId: authedUid
                }
            });

            await db.collection("stripeCheckoutSessions").doc(session.id).set({
                userId: authedUid,
                email: authedEmail,
                courseId,
                courseApplicantData: courseApplicantData || {},
                status: "created",
                createdAt: new Date().toISOString()
            });

            return res.status(200).json({ url: session.url, id: session.id });
        } catch (err) {
            console.error("Create Stripe Session Error:", err);
            return res.status(500).json({ error: err.message });
        }
    });
});

exports.verifyStripeCheckoutSession = functions.runWith({ secrets: ["STRIPE_SECRET_KEY"] }).https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method === "OPTIONS") {
            res.set("Access-Control-Allow-Origin", "*");
            res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
            res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
            res.set("Access-Control-Max-Age", "3600");
            return res.status(204).send("");
        }

        try {
            if (!stripe) {
                return res.status(500).json({ error: "Stripe is not configured on the server" });
            }
            if (req.method !== "POST") {
                return res.status(405).json({ error: "Method not allowed" });
            }

            const token = getBearerToken(req);
            if (!token) {
                return res.status(401).json({ error: "Missing Authorization token" });
            }
            const decoded = await admin.auth().verifyIdToken(token);
            const authedUid = decoded.uid;
            const authedEmail = decoded.email || null;

            const { sessionId } = req.body || {};
            if (!sessionId) throw new Error("Missing sessionId");

            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (!session || session.payment_status !== "paid") {
                return res.status(400).json({ success: false, message: "Payment not completed" });
            }
            if (session.client_reference_id !== authedUid) {
                return res.status(403).json({ success: false, message: "Session user mismatch" });
            }

            const sessionDocRef = db.collection("stripeCheckoutSessions").doc(sessionId);
            const sessionDoc = await sessionDocRef.get();
            if (!sessionDoc.exists) {
                throw new Error("Stripe checkout session record not found");
            }

            const sessionData = sessionDoc.data();
            if (sessionData.userId !== authedUid) {
                return res.status(403).json({ success: false, message: "Session ownership mismatch" });
            }

            if (sessionData.status === "processed" && sessionData.enrollmentId) {
                const existingEnroll = await db.collection("courseEnrollments").doc(sessionData.enrollmentId).get();
                if (existingEnroll.exists) {
                    const existingData = existingEnroll.data();
                    return res.status(200).json({
                        success: true,
                        accessCode: existingData.accessCode,
                        qrUrl: existingData.qrUrl
                    });
                }
            }

            const courseSnap = await db.collection("courses").doc(sessionData.courseId).get();
            if (!courseSnap.exists) throw new Error("Course not found");
            const courseData = courseSnap.data();

            const accessCode = generateAccessCode();
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(accessCode)}`;
            const enrollmentId = `${Date.now()}_${(authedEmail || "no_email").replace(/[^a-zA-Z0-9]/g, "_")}`;

            await db.collection("courseEnrollments").doc(enrollmentId).set({
                ...(sessionData.courseApplicantData || {}),
                email: authedEmail,
                userId: authedUid,
                enrolledAt: new Date().toISOString(),
                course: courseData.title,
                courseId: sessionData.courseId,
                price: courseData.price,
                paymentStatus: "paid",
                paymentProvider: "stripe",
                stripeSessionId: sessionId,
                accessCode,
                qrUrl,
                sessionDate: courseData.nextSession
            });

            await sessionDocRef.set(
                {
                    status: "processed",
                    enrollmentId,
                    processedAt: new Date().toISOString()
                },
                { merge: true }
            );

            return res.status(200).json({ success: true, accessCode, qrUrl });
        } catch (err) {
            console.error("Verify Stripe Session Error:", err);
            return res.status(500).json({ error: err.message });
        }
    });
});
