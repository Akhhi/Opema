const functions = require("firebase-functions");
const admin = require("firebase-admin");

const BASE_URL = "https://yourdomain.com";
const APP_ID = "your-app-id";

const BOT_AGENTS = [
    "whatsapp", "facebookexternalhit", "twitterbot", "linkedinbot",
    "slackbot", "telegrambot", "googlebot", "bingbot", "yandex",
    "applebot", "discordbot", "pinterest", "tumblr"
];

exports.ogProxy = functions.https.onRequest(async (req, res) => {
    const productId = req.query.product;
    const userAgent = (req.headers["user-agent"] || "").toLowerCase();
    const isBot = BOT_AGENTS.some((b) => userAgent.includes(b));

    // Real user with no product param — just serve the SPA
    if (!productId) {
        res.redirect(302, BASE_URL);
        return;
    }

    // Real user with product param — redirect to SPA immediately
    if (!isBot) {
        res.redirect(302, `${BASE_URL}/?product=${productId}`);
        return;
    }

    // Bot — fetch product and serve OG shell
    try {
        const db = admin.firestore();
        const docRef = db
            .collection("artifacts")
            .doc(APP_ID)
            .collection("public")
            .doc("data")
            .collection("products")
            .doc(productId);

        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            res.redirect(302, BASE_URL);
            return;
        }

        const p = docSnap.data();
        const productUrl = `${BASE_URL}/?product=${productId}`;
        const image = p.images && p.images[0]
            ? p.images[0].replace("/upload/", "/upload/f_auto,q_auto,w_1200,h_630,c_pad,b_white/")
            : `${BASE_URL}/images/opema.png`;

        const title = `${p.name} — OPEMA Clothing`;
        const description = p.description
            ? `${p.description} | ₹${p.price} | Free shipping across India.`
            : `Shop ${p.name} at OPEMA Clothing. Elite gear at fan prices. ₹${p.price}.`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>

  <!-- Primary -->
  <meta name="description" content="${escapeHtml(description)}">

  <!-- Open Graph -->
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

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@opemaclothing">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">

  <!-- JSON-LD -->
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
        })}
  </script>

  <!-- Instant redirect for any real browser that lands here -->
  <meta http-equiv="refresh" content="0;url=${productUrl}">
  <link rel="canonical" href="${productUrl}">
</head>
<body>
  <p>Redirecting to <a href="${productUrl}">${escapeHtml(p.name)}</a>...</p>
</body>
</html>`;

        res.set("Content-Type", "text/html");
        res.set("Cache-Control", "public, max-age=600, s-maxage=600");
        res.status(200).send(html);
    } catch (err) {
        console.error("OG proxy error:", err);
        res.redirect(302, BASE_URL);
    }
});

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}