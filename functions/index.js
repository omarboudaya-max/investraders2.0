const functions = require("firebase-functions");
const admin = require("firebase-admin");
const checkoutNodeJssdk = require("@paypal/checkout-server-sdk");
const cors = require('cors')({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// -------------------------------------------------------------
// IMPORTANT: Replace with real credentials before production
// -------------------------------------------------------------
const clientId = "AcAt1OXiTscIzvWi4FvjHW895ThsSSOysjWVxcGPddqrMoWNZ-s1mwHMwvVQX78qevu4fl748ZIYfgY8";
const clientSecret = "EJqThG8b88agDLkQVh_kphSB9dx2xkZ4xXjK-lSPD1vX1o3u30p_GyVKnFosZ7X_nzLHHf0z99Earwf9";

const environment = new checkoutNodeJssdk.core.SandboxEnvironment(clientId, clientSecret);
const client = new checkoutNodeJssdk.core.PayPalHttpClient(environment);

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

            const courseSnap = await db.collection("courses").doc(courseId).get();
            if (!courseSnap.exists) throw new Error("Course not found");
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
            return res.status(500).send(err.message);
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
            const { orderID, userEmail, courseApplicantData, courseId } = req.body;
            if (!courseId) throw new Error("Missing courseId");

            const courseSnap = await db.collection("courses").doc(courseId).get();
            if (!courseSnap.exists) throw new Error("Course not found");
            const courseData = courseSnap.data();

            const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(orderID);
            request.requestBody({});
            
            const capture = await client.execute(request);
            
            // Only proceed if capture status is COMPLETED
            if (capture.result.status === 'COMPLETED') {
                
                // Generate Access Code
                const generateAccessCode = () => {
                  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                  const segment = () => {
                    let res = '';
                    for(let i=0; i<4; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
                    return res;
                  };
                  return `INVEST-${segment()}-${segment()}`;
                }

                const accessCode = generateAccessCode();
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(accessCode)}`;

                // Save to Firestore permanently inside a secure backend
                const docId = `${Date.now()}_${userEmail}`;
                await db.collection("courseEnrollments").doc(docId).set({
                    ...courseApplicantData,
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
