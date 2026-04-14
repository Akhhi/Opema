const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const BASE_URL = "https://opema.netlify.app";
const APP_ID = "default-app-id";

const BOT_AGENTS = [
  "whatsapp", "facebookexternalhit", "twitterbot", "linkedinbot",
  "slackbot", "telegrambot", "googlebot", "bingbot", "discordbot",
  "applebot", "pinterest", "yandex"
];

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

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

exports.handler = async (event) => {
  const productId = event.queryStringParameters?.product;
  const userAgent = (event.headers["user-agent"] || "").toLowerCase();
  const isBot = BOT_AGENTS.some((b) => userAgent.includes(b));

  if (!productId) {
    return { statusCode: 302, headers: { Location: BASE_URL } };
  }

  if (!isBot) {
    return {
      statusCode: 302,
      headers: { Location: `${BASE_URL}/?product=${productId}` },
    };
  }

  try {
    initFirebase();
    const db = getFirestore();
    const docSnap = await db
      .collection("artifacts")
      .doc(APP_ID)
      .collection("public")
      .doc("data")
      .collection("products")
      .doc(productId)
      .get();

    if (!docSnap.exists) {
      return { statusCode: 302, headers: { Location: BASE_URL } };
    }

    const p = docSnap.data();
    const productUrl = `${BASE_URL}/share?product=${productId}`;
    const image = p.images && p.images[0]
      ? p.images[0].replace("/upload/", "/upload/f_auto,q_auto,w_1200,h_630,c_pad,b_white/")
      : `${BASE_URL}/og-default.png`;

    const title = `${p.name} — OPEMA Clothing`;
    const description = p.description
      ? `${p.description} · ₹${p.price} · Free shipping across India.`
      : `Shop ${p.name} at OPEMA Clothing. Elite gear at fan prices. ₹${p.price}.`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="product">
  <meta property="og:url" content="${productUrl}">
  <meta property="og:site_name" content="OPEMA Clothing">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(p.name)}">
  <meta property="og:locale" content="en_IN">
  <meta property="product:price:amount" content="${p.price}">
  <meta property="product:price:currency" content="INR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@opemaclothing">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">
  <script type="application/ld+json">
  ${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": p.name,
      "description": p.description || "",
      "image": p.images || [],
      "url": productUrl,
      "sku": productId,
      "brand": { "@type": "Brand", "name": "OPEMA Clothing" },
      "category": p.category || "Jersey",
      "offers": {
        "@type": "Offer",
        "url": productUrl,
        "priceCurrency": "INR",
        "price": p.price,
        "availability": "https://schema.org/InStock",
        "seller": { "@type": "Organization", "name": "OPEMA Clothing" }
      }
    }, null, 2)}
  </script>
  <meta http-equiv="refresh" content="0;url=${BASE_URL}/?product=${productId}">
  <link rel="canonical" href="${productUrl}">
</head>
<body>
  <p>Redirecting to <a href="${BASE_URL}/?product=${productId}">${escapeHtml(p.name)}</a>...</p>
</body>
</html>`;

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=600" },
      body: html,
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 302, headers: { Location: BASE_URL } };
  }
};
