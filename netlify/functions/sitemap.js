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
        const firestoreUrl = "https://firestore.googleapis.com/v1/projects/opema-clothing/databases/(default)/documents/artifacts/default-app-id/public/data/products";
        const response = await fetch(firestoreUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch products: ${response.statusText}`);
        }

        const data = await response.json();
        const documents = data.documents || [];
        const today = new Date().toISOString().split("T")[0];

        const productUrls = documents.map((doc) => {
            const p = parseFirestore(doc.fields);
            const docId = doc.name.split('/').pop();
            const image = p.images && p.images[0] ? p.images[0] : "";
            
            // Use REST API's updateTime or fallback
            const lastmod = doc.updateTime 
                ? doc.updateTime.split("T")[0] 
                : today;

            return `
  <url>
    <loc>${BASE_URL}/share?product=${docId}</loc>
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
