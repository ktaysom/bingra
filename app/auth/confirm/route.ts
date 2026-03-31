import { NextRequest, NextResponse } from "next/server";
import { handleAuthRedirectRequest } from "../../../lib/auth/handle-auth-redirect";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(request: NextRequest) {
  const actionUrl = escapeHtml(request.url);
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Continue sign-in | Bingra</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #f8fafc; color: #0f172a; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      .card { width: 100%; max-width: 460px; background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
      h1 { margin: 0; font-size: 1.25rem; line-height: 1.35; }
      p { margin: 10px 0 0; color: #475569; font-size: 0.92rem; line-height: 1.5; }
      .actions { margin-top: 18px; display: grid; gap: 10px; }
      button { height: 42px; border: 0; border-radius: 10px; background: #0f172a; color: white; font-weight: 600; cursor: pointer; }
      .subtle-link { display: inline-flex; align-items: center; justify-content: center; color: #475569; text-decoration: underline; text-underline-offset: 2px; font-size: 0.85rem; }
      .note { margin-top: 14px; font-size: 0.78rem; color: #64748b; }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
        <h1>Legacy sign-in link confirmation</h1>
        <p>This page supports older sign-in links. Bingra now uses email code entry in-app as the primary sign-in method.</p>
        <div class="actions">
          <form method="post" action="${actionUrl}">
            <button type="submit">Continue with this legacy link</button>
          </form>
          <a class="subtle-link" href="/">Cancel</a>
        </div>
        <p class="note">If this link was opened by a scanner or prefetcher, your sign-in code was not consumed. If you have trouble, return to Bingra and use the email code flow.</p>
      </section>
    </main>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  return handleAuthRedirectRequest(request, {
    context: "auth/confirm",
    requireCodeExchange: true,
  });
}
