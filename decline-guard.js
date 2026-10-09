/*
 * Decline fail-safe for Digistore and ClickBank upsell pages (Taha, 2026-10-09).
 *
 * Problem: when a one-click upsell charge can't go through, Digistore sends the buyer to a
 * re-checkout page (digistore24.com/confirm/...) with no "No thanks" link. The buyer gets stuck
 * and never reaches the next upsell.
 *
 * Fix: when the buyer clicks a YES link we remember it for this tab. If they ever land back on
 * this same upsell page afterwards (back button, or Digistore sends them back), we treat it as
 * a "No" and send them straight to the next step in the funnel.
 */
(function () {
  var KEY = "ds_yes_clicked:" + location.pathname.replace(/\/+$/, "");
  var MAX_AGE_MS = 60 * 60 * 1000; // only within one hour of the click
  // Digistore: .../answer/yes or .../answer/<session>/yes   ClickBank: ...pay.clickbank.net/?...cbur=a (yes) / cbur=d (no)
  var YES = /\/answer\/(?:[^\/?#]+\/)?yes|[?&]cbur=a(?:&|$)/i;
  var NO = /\/answer\/(?:[^\/?#]+\/)?no|[?&]cbur=d(?:&|$)/i;

  function store() { try { return window.sessionStorage; } catch (e) { return null; } }

  function noLink() {
    var links = document.querySelectorAll("a[href]");
    var plain = null;
    for (var i = 0; i < links.length; i++) {
      var h = links[i].href;
      if (!NO.test(h)) continue;
      if (!/\/answer\/no/i.test(h)) return h; // ClickBank link, or Digistore link that already carries the session id
      plain = plain || h;
    }
    return plain;
  }

  function goNo() {
    var waited = 0;
    (function tryGo() {
      var h = noLink();
      // give digistore.js up to 2s to add the session id to the links, then go anyway
      if (h && (!/\/answer\/no/i.test(h) || waited >= 2000)) { location.replace(h); return; }
      if (waited >= 2000) return; // no decline link on this page: leave the buyer where they are
      waited += 200;
      setTimeout(tryGo, 200);
    })();
  }

  function check() {
    var s = store();
    if (!s) return;
    var t = parseInt(s.getItem(KEY) || "0", 10);
    if (!t) return;
    s.removeItem(KEY);
    if (Date.now() - t < MAX_AGE_MS) goNo();
  }

  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || !YES.test(a.href)) return;
    var s = store();
    if (s) s.setItem(KEY, String(Date.now()));
  }, true);

  // pageshow fires on normal loads AND when the browser restores the page from its back/forward cache
  window.addEventListener("pageshow", check);
})();
