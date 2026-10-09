/* Ratings & reviews. Stored in Supabase (see tools/site/ACCOUNTS_SETUP.md):
   - only signed-in users can rate, one rating per account (they can change it later),
   - every rating from an active account counts in the average,
   - written reviews are shown only after an admin approves them.
   Until accounts are set up, ratings are emailed to you through Web3Forms instead. */
(function () {
  "use strict";
  var C = window.SP || {};
  var STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';

  function T(x, n) { return window.SP && SP.t ? SP.t(x, n) : (n == null ? x : x.replace("{n}", n)); }
  function A() { return window.SPAuth || { configured: false }; }
  function esc(s) { return String(s || "").replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function stars(avg, cls) {
    var out = "";
    for (var i = 1; i <= 5; i++) {
      var fill = Math.max(0, Math.min(1, avg - i + 1));
      out += '<span class="st ' + (cls || "") + '"><span class="st-bg">' + STAR + '</span><span class="st-fg" style="width:' + (fill * 100) + '%">' + STAR + "</span></span>";
    }
    return out;
  }
  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function ago(iso) {
    var d = (Date.now() - new Date(iso)) / 864e5;
    if (d < 1) return "today";
    if (d < 2) return "yesterday";
    if (d < 30) return Math.floor(d) + " days ago";
    return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }

  function renderStats(s) {
    var n = (s && s.count) || 0, avg = n ? Number(s.average) : 0;
    var min = C.minRatingsToShow || 3;
    all("[data-avg]").forEach(function (e) { e.textContent = n ? avg.toFixed(1) : "–"; });
    all("[data-stars]").forEach(function (e) { e.innerHTML = stars(n ? avg : 0, "lg"); });
    all("[data-count]").forEach(function (e) {
      e.textContent = n ? (n === 1 ? T("Based on 1 rating") : T("Based on {n} ratings", n.toLocaleString())) : T("No ratings yet. Be the first!");
    });
    all("[data-count-short]").forEach(function (e) { e.textContent = n ? (n === 1 ? T("1 rating") : T("{n} ratings", n.toLocaleString())) : T("Be the first to rate"); });
    for (var k = 1; k <= 5; k++) {
      var c = (s && s.stars && s.stars[k]) || 0;
      all('[data-bar="' + k + '"]').forEach(function (e) { e.style.width = (n ? (c / n * 100) : 0) + "%"; });
      all('[data-barn="' + k + '"]').forEach(function (e) { e.textContent = c; });
    }
    if (n >= min) {
      var label = stars(avg, "sm") + "<b>" + avg.toFixed(1) + "</b><span>" + n.toLocaleString() + " ratings</span>";
      all("[data-rating-pill], [data-rating-foot]").forEach(function (e) { e.innerHTML = label; e.hidden = false; });
    }
  }

  function renderList(box, rows) {
    if (!rows.length) {
      box.innerHTML = '<div class="rev-empty">' + STAR + "<p><b>" + T("No written reviews yet.") + "</b><br>" + T("Tried ScottPrivacy? Your review helps other people stay safe.") + "</p>" +
        '<a class="btn btn-primary btn-small" href="reviews.html#rate">' + T("Write the first review") + "</a></div>";
      return;
    }
    box.innerHTML = rows.map(function (r) {
      var who = esc(r.name || "ScottPrivacy user") + (r.country ? " · " + esc(r.country) : "");
      return '<article class="rev-card"><div class="rev-head"><span class="avatar">' + esc((r.name || "S").trim().charAt(0).toUpperCase()) + "</span><div><b>" + who +
        '</b><span class="rev-stars">' + stars(r.stars, "sm") + '<span class="verified" title="' + T("Written by a registered user") + '">' + T("Verified user") + '</span></span></div><time>' + ago(r.created_at) + "</time></div>" +
        (r.comment ? "<p>" + esc(r.comment) + "</p>" : "") + "</article>";
    }).join("");
  }

  // Public numbers are read with a plain request, so pages don't need the sign-in library for them.
  function rpc(name, args) {
    return fetch(C.supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/" + name, {
      method: "POST", headers: { apikey: C.supabaseKey, Authorization: "Bearer " + C.supabaseKey, "Content-Type": "application/json" },
      body: JSON.stringify(args || {}),
    }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  function load() {
    var lists = all("#rev-list, #rev-teaser");
    if (!(C.supabaseUrl && C.supabaseKey)) {
      renderStats(null);
      lists.forEach(function (b) { renderList(b, []); });
      return;
    }
    rpc("review_stats").then(function (d) { renderStats(d); seo(d); }, function () { renderStats(null); });
    lists.forEach(function (b) {
      var lim = parseInt(b.getAttribute("data-limit"), 10) || 20;
      rpc("public_reviews", { max_rows: lim }).then(function (rows) { renderList(b, rows || []); }, function () { renderList(b, []); });
    });
  }

  // Lets search engines show the star rating next to ScottPrivacy in results.
  function seo(s) {
    var n = (s && s.count) || 0;
    if (n < (C.minRatingsToShow || 3) || document.getElementById("ld-rating")) return;
    var el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "ld-rating";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org", "@type": "SoftwareApplication", name: "ScottPrivacy",
      operatingSystem: "Android", applicationCategory: "SecurityApplication",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      aggregateRating: { "@type": "AggregateRating", ratingValue: Number(s.average).toFixed(1), ratingCount: n, bestRating: 5, worstRating: 1 },
    });
    document.head.appendChild(el);
  }

  // ---------------------------------------------------------------- the rating form
  function form() {
    var f = document.getElementById("rev-form");
    if (!f) return;
    var status = document.getElementById("rev-status");
    var gate = document.getElementById("rev-gate");
    var btn = f.querySelector("button[type=submit]");
    var auth = A(), mine = null, shown = Date.now();

    function say(kind, text) { status.className = "form-status " + kind; status.textContent = text; }
    function pick(n) { var r = f.querySelector("input[name=stars][value='" + n + "']"); if (r) r.checked = true; }

    function setup() {
      if (!auth.configured) { gate.hidden = true; f.hidden = false; return; }     // no accounts yet: email fallback
      var user = auth.state.user;
      gate.hidden = !!user; f.hidden = !user;
      if (!user) return;
      if (auth.role() === "suspended") {
        f.hidden = true;
        gate.hidden = false;
        gate.innerHTML = "<p>Your account is suspended, so you can't rate right now. Contact support if you think this is a mistake.</p>";
        return;
      }
      auth.client.from("reviews").select("stars, comment, approved").eq("user_id", user.id).maybeSingle().then(function (r) {
        mine = r.data || null;
        if (!mine) return;
        pick(mine.stars);
        f.comment.value = mine.comment || "";
        btn.textContent = T("Update my rating");
        say("ok", T("You rated ScottPrivacy {n} stars.", mine.stars) +
          (mine.comment ? " " + T(mine.approved ? "Your review is published." : "Your review is waiting for a quick check.") : "") + " " + T("You can change it any time."));
      });
    }

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (f.botcheck && f.botcheck.checked) return;
      var picked = f.querySelector("input[name=stars]:checked");
      if (!picked) { say("err", T("Tap a star to choose your rating.")); return; }
      if (Date.now() - shown < 1500) { shown = 0; say("err", T("Please check your rating, then press the button again.")); return; }
      var data = { stars: parseInt(picked.value, 10), comment: f.comment.value.trim() || null };
      var label = btn.textContent;
      btn.disabled = true; btn.textContent = T("Sending…");
      var req;
      if (auth.configured) {
        if (!auth.state.user) { auth.goSignIn("review"); return; }
        data.user_id = auth.state.user.id;
        req = auth.client.from("reviews").upsert(data, { onConflict: "user_id" }).then(function (r) { if (r.error) throw r.error; });
      } else {
        req = fetch("https://api.web3forms.com/submit", {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ access_key: C.web3formsKey, subject: "ScottPrivacy rating: " + data.stars + " stars", from_name: "ScottPrivacy user",
            stars: data.stars, message: data.comment || "(no comment)" }),
        }).then(function (r) { return r.json(); }).then(function (j) { if (!j.success) throw new Error("failed"); });
      }
      req.then(function () {
        var changedText = !mine || (mine.comment || null) !== data.comment;
        mine = { stars: data.stars, comment: data.comment, approved: mine && !changedText ? mine.approved : false };
        say("ok", T(data.comment && changedText ? "Thank you! Your rating counts now; your review appears once it's checked." : "Thank you! Your rating has been saved."));
        if (auth.configured) label = T("Update my rating"); else f.reset();
        load();
      }).catch(function () {
        say("err", T("Sorry, that didn't go through. Check your connection and try again."));
      }).then(function () { btn.disabled = false; btn.textContent = label; });
    });

    if (auth.ready) auth.ready.then(setup); else setup();
    if (auth.onChange) auth.onChange(function () { setup(); });
  }

  document.addEventListener("DOMContentLoaded", function () { load(); form(); });
})();
