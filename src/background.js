"use strict";

const api = typeof browser !== "undefined" ? browser : chrome;

const ALLOWED_HOSTS = new Set(["bitbucket.org", "api.bitbucket.org"]);

function isAllowedUrl(url) {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

api.runtime.onMessage.addListener((msg, sender) => {
  if (!sender || sender.id !== api.runtime.id) return;
  if (!msg || msg.type !== "bmd-fetch") return;
  if (!isAllowedUrl(msg.url)) {
    return Promise.resolve({ ok: false, status: 0, error: "url not allowed" });
  }
  return (async () => {
    try {
      const r = await fetch(msg.url, {
        credentials: "include",
        headers: { Accept: msg.accept || "application/json" },
      });
      const text = await r.text();
      return { ok: r.ok, status: r.status, text };
    } catch (err) {
      return { ok: false, status: 0, error: String(err && err.message ? err.message : err) };
    }
  })();
});
