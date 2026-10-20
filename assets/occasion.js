/*
 * ScottPrivacy, a ScottVentures product.
 * Copyright (c) 2026 John Mwadime (johnniekips [at] gmail.com, scotttechstar [at] gmail.com). All rights reserved.
 * Proprietary and confidential: no copying, use or distribution without written permission. See LICENSE.
 */
/* Holiday greetings (like Google's doodles): reads occasions.json and, only on the right day in the right
   time zone, shows a greeting ribbon at the top of every page and decorates the logo. It switches itself
   off when the day ends. Greetings come from two places: the yearly built-in ones in occasions.json
   (tools/site/occasions.json) and the ones added in the admin dashboard › Greetings (read from the database). */
(function () {
  "use strict";
  var ZONES = { "Africa/Nairobi": "KE", "Africa/Kampala": "UG", "Africa/Dar_es_Salaam": "TZ", "Africa/Kigali": "RW",
    "Africa/Lagos": "NG", "Africa/Accra": "GH", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Africa/Johannesburg": "ZA" };

  function today(tz) {   // "YYYY-MM-DD" in that time zone
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: tz || undefined, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }
  function visitorCountry() {
    try { return ZONES[Intl.DateTimeFormat().resolvedOptions().timeZone] || ""; } catch (e) { return ""; }
  }
  function pick(map, lang) { return map ? (map[lang] || map.en || "") : ""; }
  function active(o, country) {
    var d = today(o.tz), md = d.slice(5);
    var on = (o.yearly || []).indexOf(md) >= 0 || (o.dates || []).indexOf(d) >= 0;
    if (!on) return false;
    return !(o.countries && o.countries.length) || o.countries.indexOf(country) >= 0;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function show(o) {
    var lang = (document.documentElement.lang || "en").slice(0, 2);
    var key = "sp-occasion-" + o.id + "-" + today(o.tz);
    try { if (sessionStorage.getItem(key)) return decorate(o); } catch (e) { }
    var root = (window.SP && SP.root) || "";
    var img = o.image && o.image[today(o.tz).slice(0, 4)];
    var c = o.colors || ["#2F5BEA", "#34D399", "#0B1433"];
    var bar = document.createElement("div");
    bar.className = "occasion" + (o.flag ? " flag" : "");
    bar.setAttribute("role", "note");
    bar.style.setProperty("--oc1", c[0]); bar.style.setProperty("--oc2", c[1]); bar.style.setProperty("--oc3", c[2] || c[0]);
    bar.innerHTML = '<div class="occasion-stripes" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="wrap occasion-in"><span class="occasion-ic" aria-hidden="true"></span>' +
      '<p><b>' + esc(pick(o.title, lang)) + "</b> " + esc(pick(o.text, lang)) + "</p>" +
      (img ? '<a class="occasion-link" href="' + esc(/^https:\/\//.test(img) ? img : root + img) + '" target="_blank" rel="noopener">' + esc(lang === "sw" ? "Tazama bango" : lang === "fr" ? "Voir l'affiche" : "See our poster") + "</a>" : "") +
      '<button type="button" class="occasion-x" aria-label="Close">&times;</button></div>';
    document.body.insertBefore(bar, document.body.firstChild);
    bar.querySelector(".occasion-ic").addEventListener("click", function () { celebrate(o, true); });   // once more
    setTimeout(function () { celebrate(o, false); }, 500);
    bar.querySelector(".occasion-x").addEventListener("click", function () {
      bar.remove();
      try { sessionStorage.setItem(key, "1"); } catch (e) { }
    });
    decorate(o);
  }
  // ---------------------------------------------------------------- the celebration: flowers, confetti and emojis
  // fly up from the bottom of the screen and fall away (about 4 seconds, once per greeting per day).
  function code(e) {
    return Array.from(e).map(function (c) { return c.codePointAt(0).toString(16); }).filter(function (h) { return h !== "fe0f"; }).join("-");
  }
  function celebrate(o, force) {
    if (o.celebrate === false) return;
    try { if (matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch (e) { }
    var key = "sp-celebrated-" + o.id + "-" + today(o.tz);
    try { if (!force && sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch (e) { }
    if (!document.body.animate) return;
    var root = (window.SP && SP.root) || "";
    var em = (o.emojis || []).slice(0, 8), cols = (o.colors || ["#2F5BEA", "#34D399"]).concat(["#FF8FB1", "#FFD166"]);
    var W = innerWidth, H = innerHeight, n = W < 640 ? 28 : 44;
    var box = document.createElement("div");
    box.className = "celebrate";
    box.setAttribute("aria-hidden", "true");
    document.body.appendChild(box);
    for (var i = 0; i < n; i++) {
      var el, size, kind = em.length && i % 3 !== 2 ? "emoji" : (i % 2 ? "petal" : "confetti");
      if (kind === "emoji") {
        var e = em[i % em.length];
        size = 26 + Math.random() * 26;
        el = document.createElement("img");
        el.src = root + "assets/emoji/" + code(e) + ".png";
        el.alt = "";
        el.onerror = (function (img, txt) {   // not one of our pictures: use the phone's own emoji
          return function () { var s = document.createElement("span"); s.textContent = txt; s.style.cssText = img.style.cssText + ";font-size:" + img.width + "px;line-height:1"; img.replaceWith(s); };
        })(el, e);
      } else {
        el = document.createElement("i");
        size = kind === "petal" ? 12 + Math.random() * 10 : 7 + Math.random() * 6;
        el.className = kind;
        el.style.background = cols[Math.floor(Math.random() * cols.length)];
        if (kind === "confetti") el.style.height = size * 1.8 + "px";
      }
      el.style.width = size + "px";
      if (kind === "petal") el.style.height = size * 1.25 + "px";
      box.appendChild(el);
      var x0 = Math.random() * W, peak = H * (0.15 + Math.random() * 0.5), dx = (Math.random() - 0.5) * W * 0.35;
      var spin = (Math.random() - 0.5) * 900, dur = 2600 + Math.random() * 1400;
      el.animate([
        { transform: "translate(" + x0 + "px," + (H + 60) + "px) rotate(0deg)", opacity: 1, easing: "cubic-bezier(.2,.75,.35,1)" },
        { transform: "translate(" + (x0 + dx * 0.55) + "px," + peak + "px) rotate(" + spin * 0.5 + "deg)", opacity: 1, offset: 0.42, easing: "cubic-bezier(.55,0,.85,.45)" },
        { transform: "translate(" + (x0 + dx) + "px," + (H + 80) + "px) rotate(" + spin + "deg)", opacity: 0.85 }
      ], { duration: dur, delay: Math.random() * 700, fill: "both" });
    }
    setTimeout(function () { box.remove(); }, 5200);
  }

  function decorate(o) {   // the "doodle": the logo gets the day's colours
    var c = o.colors || [];
    document.querySelectorAll(".site-header .brand img").forEach(function (im) {
      im.classList.add("occasion-logo");
      im.style.setProperty("--oc1", c[0] || "#2F5BEA");
      im.style.setProperty("--oc2", c[1] || "#34D399");
      im.style.setProperty("--oc3", c[2] || c[0] || "#0B1433");
      im.title = pick(o.title, (document.documentElement.lang || "en").slice(0, 2));
    });
  }

  function fromSite(root) {
    return fetch(root + "occasions.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return (d && d.occasions) || []; }).catch(function () { return []; });
  }
  function fromDashboard() {   // greetings added in the admin dashboard (only those showing now or soon)
    var S = window.SP || {};
    if (!S.supabaseUrl || !S.supabaseKey) return Promise.resolve([]);
    return fetch(S.supabaseUrl + "/rest/v1/rpc/occasions_feed", {
      method: "POST", body: "{}",
      headers: { "apikey": S.supabaseKey, "Authorization": "Bearer " + S.supabaseKey, "Content-Type": "application/json" }
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return (d && d.occasions) || []; }).catch(function () { return []; });
  }

  function run() {
    var root = (window.SP && SP.root) || "";
    Promise.all([fromDashboard(), fromSite(root)]).then(function (lists) {
      var all = lists[0].concat(lists[1]), country = visitorCountry();   // the dashboard's greetings come first
      for (var i = 0; i < all.length; i++) {
        if (active(all[i], country)) { show(all[i]); return; }
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
