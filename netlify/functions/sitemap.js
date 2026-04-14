const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const BASE_URL = "https://opema.netlify.app"; // replace with your real domain
const APP_ID = "your-app-id"; // same appId from your index.html

function initFirebase() {
    if (getApps().length > 0) return;
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
    });
}

function escapeXml(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

exports.handler = async () => {
    try {
        initFirebase();
        const db = getFirestore();
        const snap = await db
            .collection("artifacts")
            .doc(APP_ID)
            .collection("public")
            .doc("data")
            .collection("products")
            .get();

        const today = new Date().toISOString().split("T")[0];

        const productUrls = snap.docs.map((doc) => {
            const p = doc.data();
            const image = p.images && p.images[0] ? p.images[0] : "";
            const lastmod = p.updatedAt
                ? new Date(p.updatedAt._seconds * 1000).toISOString().split("T")[0]
                : today;

            return `
  <url>
    <loc>${BASE_URL}/share?product=${doc.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    ${image ? `<image:image>
      <image:loc>${escapeXml(image)}</image:loc>
      <image:title>${escapeXml(p.name)}</image:title>
      <image:caption>${escapeXml(p.description)}</image:caption>
    </image:image>` : ""}
  </url>`;
        });

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
${productUrls.join("\n")}
</urlset>`;

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/xml",
                "Cache-Control": "public, max-age=3600",
            },
            body: xml,
        };
    } catch (err) {
        console.error(err);
        return { statusCode: 500, body: "Sitemap generation failed" };
    }
};
