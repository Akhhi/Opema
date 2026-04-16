const BASE_URL = "https://opema.netlify.app";

function extractValue(field) {
  if (!field) return null;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return field.doubleValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('arrayValue' in field) return (field.arrayValue.values || []).map(extractValue);
  if ('mapValue' in field) {
    const obj = {};
    for (const key in field.mapValue.fields) {
      obj[key] = extractValue(field.mapValue.fields[key]);
    }
    return obj;
  }
  return null;
}

function parseFirestore(fields) {
  if (!fields) return {};
  const result = {};
  for (const key in fields) {
    result[key] = extractValue(fields[key]);
  }
  return result;
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

  if (!productId) {
    return { statusCode: 302, headers: { Location: BASE_URL } };
  }

  try {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/opema-clothing/databases/(default)/documents/artifacts/default-app-id/public/data/products/${productId}`;

    // Instead of using firebase-admin which requires credentials, we use native fetch
    // since this product database is public.
    const response = await fetch(firestoreUrl);

    if (!response.ok) {
      return { statusCode: 302, headers: { Location: BASE_URL } };
    }

    const docSnap = await response.json();

    if (!docSnap || !docSnap.fields) {
      return { statusCode: 302, headers: { Location: BASE_URL } };
    }

    const p = parseFirestore(docSnap.fields);
    const productUrl = `${BASE_URL}/share?product=${productId}`;
    const image = p.images && p.images[0]
      ? p.images[0].replace("/upload/", "/upload/f_auto,q_auto,w_1200,h_630,c_pad,b_white/")
      : `${BASE_URL}/og-default.png`;

    const title = `${p.name} — OPEMA Clothing`;
    const description = p.description
      ? `${p.description} · ₹${p.price} · Best Quality, Best Price`
      : `Shop ${p.name} at OPEMA Clothing. Elite gear at fan prices. ₹${p.price}.`;

    // Removing user-agent sniffing ensures all preview bots function properly.
    // The meta refresh and JS redirect handles human visitors.
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="product">
  <meta property="og:url" content="${escapeHtml(productUrl)}">
  <meta property="og:site_name" content="OPEMA Clothing">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(p.name)}">
  <meta property="og:locale" content="en_IN">
  <meta property="product:price:amount" content="${escapeHtml(p.price)}">
  <meta property="product:price:currency" content="INR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@opemaclothing">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
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
  <script>
    // Fallback JavaScript redirect for real users
    window.location.replace("${BASE_URL}/?product=${productId}");
  </script>
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
