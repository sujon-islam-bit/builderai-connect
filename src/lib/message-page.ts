import "server-only";

/**
 * A small standalone HTML page for flow messages (not configured, errors).
 * Used by route handlers that cannot render a React page. Brand-matched:
 * light background, white rounded card, pink accent.
 */
export function messagePage(title: string, plainLine: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — BuilderAI Connect</title>
<style>
  body { margin:0; background:#fafafa; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color:#171717; }
  .wrap { min-height:100vh; display:grid; place-items:center; padding:24px; box-sizing:border-box; }
  .card { background:#fff; border:1px solid #e5e5e5; border-radius:16px; box-shadow:0 1px 3px rgba(0,0,0,.06); max-width:440px; width:100%; padding:28px; }
  .tile { width:40px; height:40px; border-radius:12px; background:#d23b72; color:#fff; display:grid; place-items:center; font-weight:700; margin-bottom:16px; }
  h1 { font-size:20px; margin:0 0 8px; }
  p { margin:0; color:#525252; font-size:14px; line-height:1.6; }
  a { color:#d23b72; font-weight:600; text-decoration:none; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="tile">C</div>
      <h1>${title}</h1>
      <p>${plainLine}</p>
    </div>
  </div>
</body>
</html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The connect form for API_KEY providers (e.g. Telegram): plain steps,
 * one token field, one button. The signed `state` rides in a hidden
 * field and is checked against the nonce cookie on POST — the same
 * protection pattern as the OAuth flow. The token the user types is
 * only ever sent to this service over the form POST; it is never put
 * in a URL, a page or a log.
 */
export function tokenFormPage(opts: {
  title: string;
  /** Instruction lines, shown as a small numbered list. */
  steps: string[];
  /** Closing reassurance line under the steps. */
  note: string;
  state: string;
  error?: string;
  fieldLabel: string;
  placeholder: string;
  buttonLabel: string;
}): Response {
  const steps = opts.steps.map((step, i) => `<li><span class="num">${i + 1}</span><span>${escapeHtml(step)}</span></li>`).join("");
  const error = opts.error ? `<div class="error">${escapeHtml(opts.error)}</div>` : "";
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(opts.title)} — BuilderAI Connect</title>
<style>
  body { margin:0; background:#fafafa; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color:#171717; }
  .wrap { min-height:100vh; display:grid; place-items:center; padding:24px; box-sizing:border-box; }
  .card { background:#fff; border:1px solid #e5e5e5; border-radius:16px; box-shadow:0 1px 3px rgba(0,0,0,.06); max-width:440px; width:100%; padding:28px; }
  .tile { width:40px; height:40px; border-radius:12px; background:#d23b72; color:#fff; display:grid; place-items:center; font-weight:700; margin-bottom:16px; }
  h1 { font-size:20px; margin:0 0 12px; }
  ol { list-style:none; margin:0 0 12px; padding:0; display:grid; gap:8px; }
  ol li { display:flex; gap:10px; align-items:flex-start; color:#525252; font-size:14px; line-height:1.55; }
  .num { flex:none; width:20px; height:20px; border-radius:999px; background:#fdf2f7; color:#d23b72; font-size:12px; font-weight:700; display:grid; place-items:center; margin-top:1px; }
  .note { margin:0 0 20px; color:#525252; font-size:14px; line-height:1.6; }
  .error { margin:0 0 16px; border:1px solid #fecaca; background:#fef2f2; color:#991b1b; border-radius:12px; padding:10px 12px; font-size:14px; line-height:1.5; }
  label { display:block; font-size:13px; font-weight:600; margin-bottom:6px; }
  input { width:100%; box-sizing:border-box; border:1px solid #d4d4d4; border-radius:12px; padding:10px 12px; font-size:14px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  input:focus { outline:2px solid #d23b72; outline-offset:1px; border-color:transparent; }
  button { margin-top:16px; width:100%; border:0; border-radius:999px; background:#d23b72; color:#fff; font-size:14px; font-weight:600; padding:11px 16px; cursor:pointer; }
  button:hover { background:#b02d5e; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="tile">C</div>
      <h1>${escapeHtml(opts.title)}</h1>
      <ol>${steps}</ol>
      <p class="note">${escapeHtml(opts.note)}</p>
      ${error}
      <form method="post">
        <input type="hidden" name="state" value="${escapeHtml(opts.state)}" />
        <label for="token">${escapeHtml(opts.fieldLabel)}</label>
        <input id="token" name="token" type="text" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(opts.placeholder)}" />
        <button type="submit">${escapeHtml(opts.buttonLabel)}</button>
      </form>
    </div>
  </div>
</body>
</html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
