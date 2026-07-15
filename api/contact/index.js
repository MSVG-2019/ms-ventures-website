"use strict";

/*
 * M&S Ventures Group — contact form handler (Azure Static Web Apps managed function).
 *
 * Flow: honeypot check -> Cloudflare Turnstile server-side verification ->
 *       send the enquiry to MAIL_TO via Microsoft Graph (client-credentials),
 *       sending AS the MAIL_SENDER mailbox, Reply-To set to the enquirer.
 *
 * Everything stays inside Microsoft 365 — no third-party mail relay.
 *
 * Required Application Settings (configured on the Static Web App):
 *   TENANT_ID         Entra (Azure AD) tenant ID              (not secret)
 *   CLIENT_ID         App registration (client) ID            (not secret)
 *   TURNSTILE_SECRET  Cloudflare Turnstile secret key         (SECRET)
 *   MAIL_SENDER       Mailbox that sends, e.g. info@ms-ventures-group.com
 *   MAIL_TO           Destination inbox (defaults to MAIL_SENDER)
 *
 * Graph credential — ONE of the following (certificate preferred):
 *   CERT_PRIVATE_KEY  PEM private key ("\n" escapes accepted) (SECRET)
 *   CERT_THUMBPRINT   SHA-1 thumbprint of the uploaded cert   (not secret)
 *   -- or --
 *   CLIENT_SECRET     App registration client secret          (SECRET)
 *
 * Certificate auth is preferred because Entra caps client secrets at 24 months.
 * If CERT_* are set, a certificate-signed JWT assertion is used; if they are
 * absent, or the certificate path fails, the code falls back to CLIENT_SECRET.
 * That makes the cutover safe and instantly reversible: deploying this file
 * changes nothing until CERT_* exist, and deleting them reverts to the secret.
 * See: 01 - IT / 02 - WebsitesDomains / 02 - Hosting And Setup Guide /
 *      "Contact Form - Finish Setup (Entra + Azure).md" §E
 */

const https = require("https");
const crypto = require("crypto");

const {
  TENANT_ID,
  CLIENT_ID,
  CLIENT_SECRET,
  TURNSTILE_SECRET,
  MAIL_SENDER,
  CERT_PRIVATE_KEY,
  CERT_THUMBPRINT,
} = process.env;
const MAIL_TO = process.env.MAIL_TO || MAIL_SENDER;

function httpsRequest(urlStr, options, bodyStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opts = {
      method: (options && options.method) || "GET",
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: (options && options.headers) || {},
    };
    const req = https.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, text: data }));
    });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// --- Entra auth helpers: certificate (preferred) with client-secret fallback ---
const b64url = (b) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function certAssertion() {
  const x5t = b64url(
    Buffer.from(String(CERT_THUMBPRINT).replace(/[^0-9a-fA-F]/g, ""), "hex")
  );
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", x5t: x5t };
  const payload = {
    aud: "https://login.microsoftonline.com/" + TENANT_ID + "/oauth2/v2.0/token",
    iss: CLIENT_ID,
    sub: CLIENT_ID,
    jti: crypto.randomUUID(),
    nbf: now - 60,
    exp: now + 540,
  };
  const input = b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(payload));
  const sig = crypto
    .createSign("RSA-SHA256")
    .update(input)
    .end()
    .sign(String(CERT_PRIVATE_KEY).replace(/\\n/g, "\n"));
  return input + "." + b64url(sig);
}

async function requestToken(params) {
  const res = await httpsRequest(
    "https://login.microsoftonline.com/" + encodeURIComponent(TENANT_ID) + "/oauth2/v2.0/token",
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    new URLSearchParams(params).toString()
  );
  let tok = {};
  try { tok = JSON.parse(res.text); } catch (e) { tok = {}; }
  return { tok: tok, status: res.status, text: res.text };
}

async function getGraphToken(context) {
  const base = {
    client_id: CLIENT_ID,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  };
  if (CERT_PRIVATE_KEY && CERT_THUMBPRINT) {
    try {
      const r = await requestToken(
        Object.assign({}, base, {
          client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
          client_assertion: certAssertion(),
        })
      );
      if (r.tok.access_token) return r.tok.access_token;
      context.log.error("cert auth failed", r.status, r.text);
    } catch (e) {
      context.log.error("cert assertion error", e && e.message);
    }
    if (!CLIENT_SECRET) return null;
    context.log.warn("cert auth unavailable — falling back to client secret");
  }
  const r = await requestToken(Object.assign({}, base, { client_secret: CLIENT_SECRET }));
  if (!r.tok.access_token) context.log.error("secret auth failed", r.status, r.text);
  return r.tok.access_token || null;
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function htmlPage(ok) {
  const title = ok ? "Thank you" : "Something went wrong";
  const msg = ok
    ? "Your enquiry has been sent. We’ll be in touch."
    : "Your message could not be sent. Please email info@ms-ventures-group.com directly.";
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>" + title + " — M&amp;S Ventures Group</title>" +
    "<style>body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;" +
    "background:#0f0f0f;color:#eee;display:flex;min-height:100vh;align-items:center;" +
    "justify-content:center;margin:0}main{max-width:520px;padding:40px;text-align:center}" +
    "a{color:#da291c}</style></head><body><main><h1>" + title + "</h1><p>" + msg +
    '</p><p><a href="/#contact">Return to the website</a></p></main></body></html>'
  );
}

module.exports = async function (context, req) {
  const accept = (req.headers && (req.headers["accept"] || req.headers["Accept"])) || "";
  const wantsJson = accept.indexOf("application/json") !== -1;

  function reply(status, body) {
    if (wantsJson) {
      context.res = {
        status: status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      };
    } else {
      context.res = {
        status: body.ok ? 200 : status,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: htmlPage(!!body.ok),
      };
    }
  }

  try {
    let data = req.body || {};
    if (typeof data === "string") {
      const o = {};
      new URLSearchParams(data).forEach((v, k) => (o[k] = v));
      data = o;
    }

    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim();
    const org = String(data.organisation || data.organization || "").trim();
    const message = String(data.message || "").trim();
    const honey = String(data._gotcha || "").trim();
    const token = String(data["cf-turnstile-response"] || "").trim();

    // Honeypot: silently accept & drop (don't tip off bots).
    if (honey) return reply(200, { ok: true });

    if (!name || !email || !message)
      return reply(400, { ok: false, error: "missing_fields" });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return reply(400, { ok: false, error: "bad_email" });

    // 1) Verify Turnstile server-side.
    if (!TURNSTILE_SECRET) {
      context.log.error("TURNSTILE_SECRET not set");
      return reply(503, { ok: false, error: "not_configured" });
    }
    const xff = (req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"])) || "";
    const ip = xff ? xff.split(",")[0].trim() : "";
    const verifyBody = new URLSearchParams({
      secret: TURNSTILE_SECRET,
      response: token,
    });
    if (ip) verifyBody.append("remoteip", ip);
    const vRes = await httpsRequest(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      verifyBody.toString()
    );
    let verify = {};
    try { verify = JSON.parse(vRes.text); } catch (e) { verify = { success: false }; }
    if (!verify.success) return reply(400, { ok: false, error: "captcha" });

    // 2) Get a Microsoft Graph token (certificate preferred, secret fallback).
    const hasCred = (CERT_PRIVATE_KEY && CERT_THUMBPRINT) || CLIENT_SECRET;
    if (!TENANT_ID || !CLIENT_ID || !hasCred || !MAIL_SENDER) {
      context.log.error("Graph mail settings incomplete");
      return reply(503, { ok: false, error: "not_configured" });
    }
    const accessToken = await getGraphToken(context);
    if (!accessToken) return reply(502, { ok: false, error: "mail_auth" });

    // 3) Send the mail via Graph sendMail.
    const subject = "[Website Enquiry] " + name + (org ? " — " + org : "");
    const bodyHtml =
      "<p><strong>New enquiry from the M&amp;S Ventures Group website.</strong></p>" +
      "<p><strong>Name:</strong> " + esc(name) + "<br>" +
      "<strong>Email:</strong> " + esc(email) + "<br>" +
      (org ? "<strong>Organisation:</strong> " + esc(org) + "<br>" : "") +
      "</p><p><strong>Message:</strong><br>" + esc(message).replace(/\n/g, "<br>") + "</p>" +
      '<hr><p style="color:#888;font-size:12px">Sent via the website contact form. ' +
      "Reply directly to respond to the sender.</p>";

    const mail = {
      message: {
        subject: subject,
        body: { contentType: "HTML", content: bodyHtml },
        toRecipients: [{ emailAddress: { address: MAIL_TO } }],
        replyTo: [{ emailAddress: { address: email, name: name } }],
      },
      saveToSentItems: false,
    };
    const sRes = await httpsRequest(
      "https://graph.microsoft.com/v1.0/users/" + encodeURIComponent(MAIL_SENDER) + "/sendMail",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
      },
      JSON.stringify(mail)
    );
    if (sRes.status === 202) return reply(200, { ok: true });

    context.log.error("sendMail failed", sRes.status, sRes.text);
    return reply(502, { ok: false, error: "mail_send" });
  } catch (e) {
    context.log.error("contact handler error", e && e.message);
    return reply(500, { ok: false, error: "server" });
  }
};
