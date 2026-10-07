/* Ratings & reviews. Stored in Supabase (see tools/site/ACCOUNTS_SETUP.md):
   - only signed-in users can rate, one rating per account (they can change it later),
   - every rating from an active account counts in the average,
   - written reviews are shown only after an admin approves them.
   Until accounts are set up, ratings are emailed to you through Web3Forms instead. */
(function () {
  "use strict";
  var C = window.SP || {};
  var STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';

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
        '</b><span class="rev-stars">' + stars(r.stars, "sm") + '<span class="verified" title="Written by a registered user">Verified user</span></span></div><time>' + ago(r.created_at) + "</time></div>" +
        (r.comment ? "<p>" + esc(r.comment) + "</p>" : "") + "</article>";
    }).join("");
  }

  function load() {
    var lists = all("#rev-list, #rev-teaser");
    var db = A().client;
    if (!db) {
      renderStats(null);
      lists.forEach(function (b) { renderList(b, []); });
      return;
    }
    db.rpc("review_stats").then(function (r) { renderStats(r.error ? null : r.data); }, function () { renderStats(null); });
    lists.forEach(function (b) {
      var lim = parseInt(b.getAttribute("data-limit"), 10) || 20;
      db.rpc("public_reviews", { max_rows: lim }).then(function (r) { renderList(b, r.error ? [] : (r.data || [])); }, function () { renderList(b, []); });
    });
  }

  // ---------------------------------------------------------------- the rating form
  function form() {
    var f = document.getElementById("rev-form");
    if (!f) return;
    var status = document.getElementById("rev-status");
    var gate = document.getElementById("rev-gate");
    var btn = f.querySelector("button[type=submit]");
    var auth = A(), mine = null;

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
        btn.textContent = "Update my rating";
        say("ok", "You rated ScottPrivacy " + mine.stars + " star" + (mine.stars > 1 ? "s" : "") + "." +
          (mine.comment ? (mine.approved ? " Your review is published." : " Your review is waiting for a quick check.") : "") + " You can change it any time.");
      });
    }

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (f.botcheck && f.botcheck.checked) return;
      var picked = f.querySelector("input[name=stars]:checked");
      if (!picked) { say("err", "Tap a star to choose your rating."); return; }
      var data = { stars: parseInt(picked.value, 10), comment: f.comment.value.trim() || null };
      var label = btn.textContent;
      btn.disabled = true; btn.textContent = "Sending…";
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
        say("ok", data.comment && changedText ? "Thank you! Your rating counts now; your review appears once it's checked." : "Thank you! Your rating has been saved.");
        if (auth.configured) label = "Update my rating"; else f.reset();
        load();
      }).catch(function () {
        say("err", "Sorry, that didn't go through. Check your connection and try again.");
      }).then(function () { btn.disabled = false; btn.textContent = label; });
    });

    if (auth.ready) auth.ready.then(setup); else setup();
    if (auth.onChange) auth.onChange(function () { setup(); });
  }

  document.addEventListener("DOMContentLoaded", function () { load(); form(); });
})();
