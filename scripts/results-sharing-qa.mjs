#!/usr/bin/env node

function usage() {
  console.log("Usage: node scripts/results-sharing-qa.mjs <public-results-url>");
  console.log("Example: node scripts/results-sharing-qa.mjs https://bingra.com/g/abc123/results");
}

function readMeta(html, propertyName) {
  const escaped = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regexes = [
    new RegExp(`<meta[^>]*property=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${escaped}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*name=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${escaped}["'][^>]*>`, "i"),
  ];

  for (const regex of regexes) {
    const match = html.match(regex);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function statusLabel(ok) {
  return ok ? "✅" : "❌";
}

const inputUrl = process.argv[2];
if (!inputUrl) {
  usage();
  process.exit(1);
}

let resultsUrl;
try {
  resultsUrl = new URL(inputUrl);
} catch {
  console.error("Invalid URL:", inputUrl);
  process.exit(1);
}

if (!/^https?:$/.test(resultsUrl.protocol)) {
  console.error("URL must be http(s):", resultsUrl.toString());
  process.exit(1);
}

console.log(`\nBingra Results Sharing QA\nURL: ${resultsUrl.toString()}\n`);

const pageResponse = await fetch(resultsUrl.toString(), {
  headers: {
    "user-agent": "bingra-results-qa/1.0",
  },
});

const pageHtml = await pageResponse.text();
const pageOk = pageResponse.ok;

const ogTitle = readMeta(pageHtml, "og:title");
const ogDescription = readMeta(pageHtml, "og:description");
const ogImage = readMeta(pageHtml, "og:image");
const twitterCard = readMeta(pageHtml, "twitter:card");
const twitterImage = readMeta(pageHtml, "twitter:image");

const hasRequiredMeta = Boolean(ogTitle && ogDescription && ogImage && twitterCard && twitterImage);
const twitterLargeImage = twitterCard === "summary_large_image";

let ogImageAbsolute = false;
let ogImagePublic = false;
let ogImageStatus = "n/a";
let ogImageContentType = "n/a";

if (ogImage) {
  try {
    const imageUrl = new URL(ogImage);
    ogImageAbsolute = true;
    const host = imageUrl.hostname.toLowerCase();
    ogImagePublic = host !== "localhost" && host !== "127.0.0.1";

    const imageResponse = await fetch(imageUrl.toString(), {
      method: "GET",
      headers: {
        "user-agent": "bingra-results-qa/1.0",
      },
    });
    ogImageStatus = `${imageResponse.status}`;
    ogImageContentType = imageResponse.headers.get("content-type") ?? "(missing)";
  } catch {
    ogImageStatus = "request failed";
  }
}

const facebookDebugger = `https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(resultsUrl.toString())}`;
const xValidator = "https://cards-dev.twitter.com/validator";

console.log(`${statusLabel(pageOk)} Results page HTTP status: ${pageResponse.status}`);
console.log(`${statusLabel(hasRequiredMeta)} Required metadata present`);
console.log(`  - og:title: ${ogTitle ?? "(missing)"}`);
console.log(`  - og:description: ${ogDescription ?? "(missing)"}`);
console.log(`  - og:image: ${ogImage ?? "(missing)"}`);
console.log(`  - twitter:card: ${twitterCard ?? "(missing)"}`);
console.log(`  - twitter:image: ${twitterImage ?? "(missing)"}`);
console.log(`${statusLabel(twitterLargeImage)} twitter:card is summary_large_image`);
console.log(`${statusLabel(ogImageAbsolute)} og:image is absolute URL`);
console.log(`${statusLabel(ogImagePublic)} og:image is public (not localhost)`);
console.log(`${statusLabel(/^2\\d\\d$/.test(ogImageStatus))} og:image fetch status: ${ogImageStatus}`);
console.log(`${statusLabel(ogImageContentType.includes("image"))} og:image content-type: ${ogImageContentType}`);

console.log("\nManual unfurl checks:");
console.log(`- Facebook debugger: ${facebookDebugger}`);
console.log(`- X card validator: ${xValidator}`);
console.log("- iMessage/Slack: paste the results URL and verify image preview appears.");

console.log("\nRecommended report fields:");
console.log("- slug tested");
console.log("- og:title / og:description / og:image");
console.log("- image HTTP status + content-type");
console.log("- Facebook/X unfurl outcome");
console.log("- winner modal vs preview image differences");
