"use strict";

const api = typeof browser !== "undefined" ? browser : chrome;

api.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== "bmd-fetch") return;
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
