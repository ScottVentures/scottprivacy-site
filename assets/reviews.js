/* Ratings & reviews. Stored in a small Supabase database (see tools/site/REVIEWS_SETUP.md):
   - anyone can add a rating (one per network per 30 days, enforced by the database),
   - every rating counts in the average,
   - written reviews are shown only after you approve them.
   Until the database is configured, ratings are emailed to you through Web3Forms instead. */
(function () {
  "use strict";
  var C = window.SP || {};
  var DB = C.supabaseUrl && C.supabaseKey;
  var STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ apikey: C.supabaseKey, Authorization: "Bearer " + C.supabaseKey, "Content-Type": "application/json" }, opts.headers || {});
    return fetch(C.supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + path, opts);
  }
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
      e.textContent = n ? "Based on " + n.toLocaleString() + " rating" + (n === 1 ? "" : "s") : "No ratings yet. Be the first!";
    });
    all("[data-count-short]").forEach(function (e) { e.textContent = n ? n.toLocaleString() + " rating" + (n === 1 ? "" : "s") : "Be the first to rate"; });
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
      box.innerHTML = '<div class="rev-empty">' + STAR + "<p><b>No written reviews yet.</b><br>Tried ScottPrivacy? Your review helps other people stay safe.</p>" +
        '<a class="btn btn-primary btn-small" href="reviews.html#rate">Write the first review</a></div>';
      return;
    }
    box.innerHTML = rows.map(function (r) {
      var who = esc(r.name || "ScottPrivacy user") + (r.country ? " · " + esc(r.country) : "");
      return '<article class="rev-card"><div class="rev-head"><span class="avatar">' + esc((r.name || "S").trim().charAt(0).toUpperCase()) + "</span><div><b>" + who +
        '</b><span class="rev-stars">' + stars(r.stars, "sm") + "</span></div><time>" + ago(r.created_at) + "</time></div>" +
        (r.comment ? "<p>" + esc(r.comment) + "</p>" : "") + "</article>";
    }).join("");
  }

  function load() {
    var lists = all("#rev-list, #rev-teaser");
    if (!DB) {
      renderStats(null);
      lists.forEach(function (b) { renderList(b, []); });
      return;
    }
    api("rpc/review_stats", { method: "POST", body: "{}" }).then(function (r) { return r.json(); }).then(renderStats).catch(function () { renderStats(null); });
    lists.forEach(function (b) {
      var lim = parseInt(b.getAttribute("data-limit"), 10) || 20;
      api("reviews?select=stars,name,country,comment,created_at&comment=not.is.null&order=created_at.desc&limit=" + lim)
        .then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) { renderList(b, rows); })
        .catch(function () { renderList(b, []); });
    });
  }

  function form() {
    var f = document.getElementById("rev-form");
    if (!f) return;
    var status = document.getElementById("rev-status");
    var done = null;
    try { done = localStorage.getItem("sp_rated"); } catch (e) { }
    if (done) {
      status.className = "form-status ok";
      status.textContent = "Thanks, you've already rated ScottPrivacy from this browser.";
    }
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (f.botcheck.checked) return;
      var picked = f.querySelector("input[name=stars]:checked");
      if (!picked) { status.className = "form-status err"; status.textContent = "Tap a star to choose your rating."; return; }
      var data = { stars: parseInt(picked.value, 10), name: f.name.value.trim() || null, country: f.country.value.trim() || null, comment: f.comment.value.trim() || null };
      var btn = f.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = "Sending…";
      var req;
      if (DB) {
        req = api("reviews", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(data) }).then(function (r) {
          if (r.ok) return;
          return r.json().then(function (j) { throw new Error((j && j.message) || "failed"); });
        });
      } else {
        req = fetch("https://api.web3forms.com/submit", {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ access_key: C.web3formsKey, subject: "ScottPrivacy rating: " + data.stars + " stars", from_name: data.name || "ScottPrivacy user",
            stars: data.stars, name: data.name, country: data.country, message: data.comment || "(no comment)" }),
        }).then(function (r) { return r.json(); }).then(function (j) { if (!j.success) throw new Error("failed"); });
      }
      req.then(function () {
        try { localStorage.setItem("sp_rated", "1"); } catch (e) { }
        f.reset();
        status.className = "form-status ok";
        status.textContent = data.comment ? "Thank you! Your rating counts now; your review appears once it's checked." : "Thank you! Your rating has been counted.";
        load();
      }).catch(function (err) {
        status.className = "form-status err";
        status.textContent = /already rated/i.test(err.message) ? "You've already rated ScottPrivacy recently. Thank you!" : "Sorry, that didn't go through. Check your connection and try again.";
      }).then(function () { btn.disabled = false; btn.textContent = "Submit rating"; });
    });
  }

  document.addEventListener("DOMContentLoaded", function () { load(); form(); });
})();
