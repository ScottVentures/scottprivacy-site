/*
 * ScottPrivacy, a ScottVentures product.
 * Copyright (c) 2026 John Mwadime (johnniekips [at] gmail.com, scotttechstar [at] gmail.com). All rights reserved.
 * Proprietary and confidential: no copying, use or distribution without written permission. See LICENSE.
 */
/* Admin dashboard. Every action is checked again by the database or the admin-users function, so
   hiding buttons here is only for convenience, not security. */
(function () {
  "use strict";
  var A = window.SPAuth, esc = A.esc, db;
  var root, tab = "overview", users = [], reviews = [], downloads = [], scams = [], crashes = [], allowed = [], callerNames = [], greetings = [], greetErr = null, builtIn = [], filter = { q: "", role: "", status: "", rev: "pending" };
  var NS = "http://www.w3.org/2000/svg";

  function $(s) { return root.querySelector(s); }
  function fmtDate(s) { return s ? new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "–"; }
  function fmtAgo(s) {
    if (!s) return "never";
    var m = (Date.now() - new Date(s)) / 6e4;
    if (m < 2) return "just now"; if (m < 60) return Math.floor(m) + " min ago";
    if (m < 1440) return Math.floor(m / 60) + " h ago"; var d = Math.floor(m / 1440); return d === 1 ? "yesterday" : d + " days ago";
  }
  function toast(text, bad) {
    var t = document.createElement("div"); t.className = "admin-toast" + (bad ? " bad" : ""); t.textContent = text;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3500);
  }
  function fn(action, extra) {
    return db.functions.invoke("admin-users", { body: Object.assign({ action: action }, extra || {}) }).then(function (r) {
      if (r.error) {
        return (r.error.context && r.error.context.json ? r.error.context.json() : Promise.resolve({})).then(function (j) {
          throw new Error((j && j.error) || "The admin-users function isn't deployed yet (see tools/site/ACCOUNTS_SETUP.md).");
        });
      }
      if (r.data && r.data.error) throw new Error(r.data.error);
      return r.data;
    });
  }
  function rpc(name, args) { return db.rpc(name, args || {}).then(function (r) { if (r.error) throw r.error; return r.data; }); }

  // ---------------------------------------------------------------- data
  function loadAll() {
    return Promise.all([
      db.from("profiles").select("*").order("created_at", { ascending: false }).limit(1000),
      db.from("reviews").select("id, stars, comment, approved, created_at, updated_at, user_id, profiles(email, full_name, country)").order("updated_at", { ascending: false }).limit(500),
      db.from("downloads").select("id, version, created_at, user_id, profiles(email, full_name)").order("created_at", { ascending: false }).limit(500),
      db.from("scam_reports").select("id, number, kind, created_at, user_id").order("created_at", { ascending: false }).limit(5000),
      db.from("crash_reports").select("id, app_version, device, android, report, created_at, profiles(email)").order("created_at", { ascending: false }).limit(200),
      db.from("scam_allow").select("number"),
      db.from("caller_names").select("number, name, verified, created_at, updated_at, user_id, profiles(email, full_name)").order("updated_at", { ascending: false }).limit(2000),
      db.from("occasions").select("*").order("starts_on", { ascending: false }).limit(300),
      fetch(window.SP.root + "occasions.json", { cache: "no-cache" }).then(function (x) { return x.ok ? x.json() : {}; }).catch(function () { return {}; }),
    ]).then(function (r) {
      greetings = r[7].data || []; greetErr = r[7].error || null; builtIn = (r[8] && r[8].occasions) || [];
      callerNames = r[6].data || [];
      users = r[0].data || []; reviews = r[1].data || []; downloads = r[2].data || [];
      scams = r[3].data || []; crashes = r[4].data || []; allowed = (r[5].data || []).map(function (x) { return x.number; });
    });
  }

  // ---------------------------------------------------------------- layout
  function shell() {
    var me = A.state.profile, sup = A.role() === "super_admin";
    root.innerHTML =
      '<div class="admin-top"><div><span class="eyebrow">' + (sup ? "Super admin" : "Admin") + "</span><h1>Dashboard</h1>" +
      '<p class="muted">Signed in as ' + esc(me.full_name || A.state.user.email) + "</p></div>" +
      '<button class="btn btn-outline btn-small" type="button" data-refresh>Refresh</button></div>' +
      '<div class="admin-tabs" role="tablist">' +
      ["overview:Overview", "users:Users", "reviews:Reviews", "reports:Scam reports", "names:Caller names", "greetings:Greetings", "downloads:Downloads", "crashes:Crashes"].map(function (t) {
        var k = t.split(":")[0];
        return '<button type="button" role="tab" data-tab="' + k + '" aria-selected="' + (tab === k) + '">' + t.split(":")[1] +
          (k === "reviews" ? ' <span class="count" data-pending></span>' : "") + "</button>";
      }).join("") + '</div><div id="admin-body"></div>';
    root.querySelectorAll("[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () { tab = b.getAttribute("data-tab"); shell(); body(); });
    });
    root.querySelector("[data-refresh]").addEventListener("click", function () { loadAll().then(body); });
    var pending = reviews.filter(function (r) { return !r.approved && r.comment; }).length;
    var pb = root.querySelector("[data-pending]"); if (pb) pb.textContent = pending ? pending : "";
  }

  function body() {
    var b = $("#admin-body");
    if (tab === "overview") overview(b);
    else if (tab === "users") usersTab(b);
    else if (tab === "reviews") reviewsTab(b);
    else if (tab === "reports") reportsTab(b);
    else if (tab === "crashes") crashesTab(b);
    else if (tab === "names") namesTab(b);
    else if (tab === "greetings") greetingsTab(b);
    else downloadsTab(b);
  }

  // ---------------------------------------------------------------- overview
  function overview(b) {
    b.innerHTML = '<div class="tiles admin-tiles" id="ov-tiles"><div class="tile"><div class="lbl">Loading…</div></div></div>' +
      '<div class="admin-charts"><div class="chart-card"><h3>New accounts</h3><p class="sub">Last 60 days</p><div class="chart" id="ch-signups"></div></div>' +
      '<div class="chart-card"><h3>Downloads by signed-in users</h3><p class="sub">Last 60 days</p><div class="chart" id="ch-dl"></div></div></div>';
    rpc("admin_overview").then(function (o) {
      var avg = reviews.length ? (reviews.reduce(function (s, r) { return s + r.stars; }, 0) / reviews.length).toFixed(1) : "–";
      var tiles = [["Accounts", o.users, "+" + o.users_7d + " this week"], ["Active this week", o.active_7d, "Signed in during the last 7 days"],
        ["Downloads", o.downloads, "+" + o.downloads_7d + " this week"], ["Average rating", avg, reviews.length + " ratings"],
        ["Reviews to check", o.pending_reviews, o.pending_reviews ? "Waiting for approval" : "All caught up"], ["Suspended", o.suspended, "Accounts blocked"],
        ["Scam reports", o.scam_reports || 0, "+" + (o.scam_reports_7d || 0) + " this week"], ["Crashes", o.crashes_7d || 0, "In the last 7 days"]];
      $("#ov-tiles").innerHTML = tiles.map(function (t) {
        return '<div class="tile"><div class="lbl">' + t[0] + '</div><div class="val">' + esc(t[1]) + '</div><div class="sub">' + esc(t[2]) + "</div></div>";
      }).join("");
      bars($("#ch-signups"), o.signups || [], "accounts");
      bars($("#ch-dl"), o.downloads_by_day || [], "downloads");
    }).catch(function (e) { $("#ov-tiles").innerHTML = '<p class="form-status err">' + esc(e.message) + "</p>"; });
  }

  function bars(box, rows, noun) {
    var days = [], map = {};
    rows.forEach(function (r) { map[r.date] = r.n; });
    for (var i = 59; i >= 0; i--) { var d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); days.push({ d: d, n: map[d] || 0 }); }
    var W = 600, H = 200, L = 34, B = 24, T = 8, max = Math.max(4, Math.max.apply(null, days.map(function (x) { return x.n; })));
    max = Math.ceil(max / 4) * 4;
    var s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 " + W + " " + H); s.setAttribute("role", "img");
    s.setAttribute("aria-label", noun + " per day");
    var html = "";
    for (var g = 0; g <= 4; g++) {
      var y = T + (H - T - B) * (1 - g / 4);
      html += '<line x1="' + L + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" class="gl"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end" class="ax">' + (max * g / 4) + "</text>";
    }
    var bw = (W - L) / days.length;
    days.forEach(function (x, i) {
      var h = (H - T - B) * x.n / max, xx = L + i * bw + 1;
      html += '<rect class="bar" x="' + xx.toFixed(1) + '" y="' + (H - B - h).toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + Math.max(h, x.n ? 2 : 0).toFixed(1) + '" rx="2"><title>' +
        x.n + " " + noun + " · " + fmtDate(x.d) + "</title></rect>";
      if (i % 15 === 0) html += '<text class="ax" x="' + xx + '" y="' + (H - 6) + '">' + new Date(x.d).toLocaleDateString(undefined, { day: "numeric", month: "short" }) + "</text>";
    });
    s.innerHTML = html;
    box.innerHTML = ""; box.appendChild(s);
  }

  // ---------------------------------------------------------------- users
  function usersTab(b) {
    var sup = A.role() === "super_admin", meId = A.state.user.id;
    var dlCount = {}; downloads.forEach(function (d) { dlCount[d.user_id] = (dlCount[d.user_id] || 0) + 1; });
    var q = filter.q.toLowerCase();
    var list = users.filter(function (u) {
      return (!q || (u.email || "").toLowerCase().indexOf(q) >= 0 || (u.full_name || "").toLowerCase().indexOf(q) >= 0 || (u.country || "").toLowerCase().indexOf(q) >= 0) &&
        (!filter.role || u.role === filter.role) && (!filter.status || u.status === filter.status);
    });
    b.innerHTML =
      '<div class="admin-bar"><input type="search" placeholder="Search name, email or country" value="' + esc(filter.q) + '" data-q>' +
      '<select data-frole><option value="">All roles</option><option value="user">Users</option><option value="admin">Admins</option><option value="super_admin">Super admins</option></select>' +
      '<select data-fstatus><option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option></select>' +
      (sup ? '<button class="btn btn-primary btn-small" type="button" data-add>+ Add user</button>' : "") + "</div>" +
      '<p class="muted small">' + list.length + " of " + users.length + ' accounts</p>' +
      '<div class="table-wrap"><table class="table admin-table"><thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Joined</th><th>Last seen</th><th>Downloads</th><th></th></tr></thead><tbody>' +
      list.map(function (u) {
        var self = u.id === meId;
        var roleCell = sup && !self
          ? '<select data-role="' + u.id + '">' + ["user", "admin", "super_admin"].map(function (r) {
            return '<option value="' + r + '"' + (u.role === r ? " selected" : "") + ">" + { user: "User", admin: "Admin", super_admin: "Super admin" }[r] + "</option>";
          }).join("") + "</select>"
          : '<span class="role-badge ' + u.role + '">' + { user: "User", admin: "Admin", super_admin: "Super admin" }[u.role] + "</span>";
        var canSuspend = !self && (u.role === "user" || sup);
        return "<tr><td><b>" + esc(u.full_name || "—") + "</b><span class='sub'>" + esc(u.email) + (u.country ? " · " + esc(u.country) : "") + (self ? " · you" : "") + "</span></td>" +
          "<td>" + roleCell + "</td>" +
          '<td><span class="status ' + u.status + '">' + (u.status === "active" ? "Active" : "Suspended") + "</span></td>" +
          "<td>" + fmtDate(u.created_at) + "</td><td>" + fmtAgo(u.last_seen) + "</td><td>" + (dlCount[u.id] || 0) + "</td>" +
          '<td class="acts">' +
          (canSuspend ? '<button type="button" class="link" data-ban="' + u.id + '" data-on="' + (u.status === "active") + '">' + (u.status === "active" ? "Suspend" : "Activate") + "</button>" : "") +
          (!self ? '<button type="button" class="link" data-reset="' + u.id + '">Reset password</button>' : "") +
          (sup && !self ? '<button type="button" class="link danger" data-del="' + u.id + '">Delete</button>' : "") +
          "</td></tr>";
      }).join("") + "</tbody></table></div>";

    var qi = $("[data-q]");
    qi.addEventListener("input", function () { filter.q = qi.value; var pos = qi.selectionStart; usersTab(b); var n = $("[data-q]"); n.focus(); n.setSelectionRange(pos, pos); });
    $("[data-frole]").value = filter.role; $("[data-fstatus]").value = filter.status;
    $("[data-frole]").addEventListener("change", function (e) { filter.role = e.target.value; usersTab(b); });
    $("[data-fstatus]").addEventListener("change", function (e) { filter.status = e.target.value; usersTab(b); });
    if ($("[data-add]")) $("[data-add]").addEventListener("click", addUserDialog);

    b.querySelectorAll("[data-role]").forEach(function (s) {
      s.addEventListener("change", function () {
        var id = s.getAttribute("data-role"), u = users.find(function (x) { return x.id === id; });
        if (!confirm("Make " + (u.full_name || u.email) + " " + s.options[s.selectedIndex].text + "?")) { s.value = u.role; return; }
        rpc("admin_set_role", { target: id, new_role: s.value }).then(function () { u.role = s.value; toast("Role changed"); usersTab(b); })
          .catch(function (e) { s.value = u.role; toast(e.message, true); });
      });
    });
    b.querySelectorAll("[data-ban]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-ban"), on = btn.getAttribute("data-on") === "true", u = users.find(function (x) { return x.id === id; });
        if (on && !confirm("Suspend " + (u.full_name || u.email) + "? They won't be able to sign in, download or review.")) return;
        fn(on ? "ban" : "unban", { user_id: id })
          .catch(function () { return rpc("admin_set_status", { target: id, new_status: on ? "suspended" : "active" }); })
          .then(function () { u.status = on ? "suspended" : "active"; toast(on ? "Account suspended" : "Account activated"); usersTab(b); })
          .catch(function (e) { toast(e.message, true); });
      });
    });
    b.querySelectorAll("[data-reset]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        fn("reset_link", { user_id: btn.getAttribute("data-reset") }).then(function () { toast("Password reset email sent"); }).catch(function (e) { toast(e.message, true); });
      });
    });
    b.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-del"), u = users.find(function (x) { return x.id === id; });
        var typed = prompt("This permanently deletes " + u.email + ", their review and download history.\nType DELETE to confirm.");
        if (typed !== "DELETE") return;
        fn("delete_user", { user_id: id }).then(function () {
          users = users.filter(function (x) { return x.id !== id; }); toast("Account deleted"); usersTab(b);
        }).catch(function (e) { toast(e.message, true); });
      });
    });
  }

  function addUserDialog() {
    var d = document.createElement("dialog");
    d.className = "admin-dialog";
    d.innerHTML = '<form class="form" method="dialog" novalidate><h3>Add a user</h3>' +
      '<div class="row"><label>Full name<input name="full_name" maxlength="60"></label><label>Country<input name="country" maxlength="40"></label></div>' +
      '<label>Email<input name="email" type="email" required></label>' +
      '<label>Role<select name="role"><option value="user">User</option><option value="admin">Admin</option><option value="super_admin">Super admin</option></select></label>' +
      '<fieldset class="choice"><label class="check"><input type="radio" name="how" value="invite" checked> Email them an invitation to set their own password</label>' +
      '<label class="check"><input type="radio" name="how" value="password"> Set a password for them now</label></fieldset>' +
      '<label data-pw hidden>Password<input name="password" type="text" minlength="8" autocomplete="off"><span class="hint">At least 8 characters. Share it privately.</span></label>' +
      '<p class="form-status" role="status"></p><div class="dlg-acts"><button type="button" class="btn btn-outline btn-small" data-cancel>Cancel</button>' +
      '<button type="submit" class="btn btn-primary btn-small">Create user</button></div></form>';
    document.body.appendChild(d);
    var f = d.querySelector("form"), st = f.querySelector(".form-status");
    f.querySelectorAll("input[name=how]").forEach(function (r) { r.addEventListener("change", function () { f.querySelector("[data-pw]").hidden = f.how.value !== "password"; }); });
    d.querySelector("[data-cancel]").addEventListener("click", function () { d.close(); d.remove(); });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!f.email.checkValidity()) { f.email.reportValidity(); return; }
      var btn = f.querySelector("button[type=submit]"); btn.disabled = true;
      fn("create_user", { email: f.email.value.trim(), full_name: f.full_name.value.trim(), country: f.country.value.trim(), role: f.role.value,
        password: f.how.value === "password" ? f.password.value : "" })
        .then(function () { d.close(); d.remove(); toast(f.how.value === "password" ? "User created" : "Invitation sent"); return loadAll(); })
        .then(function () { tab = "users"; shell(); body(); })
        .catch(function (err) { st.className = "form-status err"; st.textContent = err.message; btn.disabled = false; });
    });
    d.showModal();
  }

  // ---------------------------------------------------------------- reviews
  function reviewsTab(b) {
    var list = reviews.filter(function (r) {
      if (filter.rev === "pending") return !r.approved && r.comment;
      if (filter.rev === "approved") return r.approved;
      return true;
    });
    b.innerHTML = '<div class="admin-bar"><div class="seg">' + [["pending", "Waiting"], ["approved", "Published"], ["all", "All ratings"]].map(function (x) {
      return '<button type="button" data-rf="' + x[0] + '" aria-pressed="' + (filter.rev === x[0]) + '">' + x[1] + "</button>";
    }).join("") + "</div></div>" +
      (list.length ? '<div class="rev-admin">' + list.map(function (r) {
        var p = r.profiles || {};
        return '<article class="rev-card"><div class="rev-head"><span class="avatar">' + esc((p.full_name || p.email || "?").charAt(0).toUpperCase()) + "</span><div><b>" +
          esc(p.full_name || "—") + "</b><span class='sub'>" + esc(p.email || "") + (p.country ? " · " + esc(p.country) : "") + "</span></div><time>" + fmtAgo(r.updated_at) + "</time></div>" +
          '<p class="stars-txt">' + "★★★★★".slice(0, r.stars) + "<span>" + "★★★★★".slice(r.stars) + "</span></p>" +
          (r.comment ? "<p>" + esc(r.comment) + "</p>" : "<p class='muted small'>Stars only (counts in the score, nothing to publish)</p>") +
          '<div class="acts">' + (r.comment ? (r.approved ? '<button class="btn btn-outline btn-small" data-hide="' + r.id + '">Unpublish</button>' : '<button class="btn btn-primary btn-small" data-approve="' + r.id + '">Approve</button>') : "") +
          '<button class="btn btn-outline btn-small danger" data-rdel="' + r.id + '">Delete</button></div></article>';
      }).join("") + "</div>" : '<p class="muted">Nothing here.</p>');
    b.querySelectorAll("[data-rf]").forEach(function (x) { x.addEventListener("click", function () { filter.rev = x.getAttribute("data-rf"); reviewsTab(b); }); });
    function setApproved(id, val) {
      db.from("reviews").update({ approved: val }).eq("id", id).then(function (r) {
        if (r.error) throw r.error;
        reviews.forEach(function (x) { if (x.id == id) x.approved = val; });
        toast(val ? "Review published" : "Review unpublished"); shell(); body();
      }).catch(function (e) { toast(e.message, true); });
    }
    b.querySelectorAll("[data-approve]").forEach(function (x) { x.addEventListener("click", function () { setApproved(x.getAttribute("data-approve"), true); }); });
    b.querySelectorAll("[data-hide]").forEach(function (x) { x.addEventListener("click", function () { setApproved(x.getAttribute("data-hide"), false); }); });
    b.querySelectorAll("[data-rdel]").forEach(function (x) {
      x.addEventListener("click", function () {
        if (!confirm("Delete this rating? It will no longer count in the score.")) return;
        var id = x.getAttribute("data-rdel");
        db.from("reviews").delete().eq("id", id).then(function (r) {
          if (r.error) throw r.error;
          reviews = reviews.filter(function (y) { return y.id != id; }); toast("Rating deleted"); shell(); body();
        }).catch(function (e) { toast(e.message, true); });
      });
    });
  }

  // ---------------------------------------------------------------- scam reports
  var MIN_REPORTS = 3;   // same as COMMUNITY_MIN_REPORTS in the app
  function reportsTab(b) {
    var by = {};
    scams.forEach(function (r) {
      var e = by[r.number] || (by[r.number] = { number: r.number, people: {}, kinds: {}, last: r.created_at });
      e.people[r.user_id] = 1; e.kinds[r.kind] = 1;
      if (r.created_at > e.last) e.last = r.created_at;
    });
    var list = Object.keys(by).map(function (k) { var e = by[k]; e.n = Object.keys(e.people).length; return e; })
      .sort(function (a, b) { return b.n - a.n || (b.last > a.last ? 1 : -1); });
    b.innerHTML = '<p class="muted small">Numbers reported by at least ' + MIN_REPORTS + ' people are sent to every phone, which then blocks or flags them. ' +
      'Mark a number "Not a scam" if it was reported by mistake (it then never goes to phones).</p>' +
      (list.length ? '<div class="table-wrap"><table class="table admin-table"><thead><tr><th>Number</th><th>People</th><th>Type</th><th>Last report</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (e) {
        var ok = allowed.indexOf(e.number) >= 0;
        var status = ok ? '<span class="status active">Not a scam</span>' : (e.n >= MIN_REPORTS ? '<span class="status suspended">On phones</span>' : '<span class="muted small">Needs ' + (MIN_REPORTS - e.n) + ' more</span>');
        return "<tr><td><b>" + esc(e.number) + "</b></td><td>" + e.n + "</td><td>" + Object.keys(e.kinds).join(", ") + "</td><td>" + fmtAgo(e.last) + "</td><td>" + status + "</td>" +
          '<td class="acts">' + (ok ? '<button type="button" class="link" data-unallow="' + esc(e.number) + '">Undo</button>' : '<button type="button" class="link" data-allow="' + esc(e.number) + '">Not a scam</button>') +
          '<button type="button" class="link danger" data-sdel="' + esc(e.number) + '">Delete reports</button></td></tr>';
      }).join("") + "</tbody></table></div>" : '<p class="muted">No reports yet.</p>');
    function done(msg) { toast(msg); loadAll().then(body); }
    b.querySelectorAll("[data-allow]").forEach(function (x) {
      x.addEventListener("click", function () {
        db.from("scam_allow").insert({ number: x.getAttribute("data-allow") }).then(function (r) { if (r.error) throw r.error; done("Marked as not a scam"); }).catch(function (e) { toast(e.message, true); });
      });
    });
    b.querySelectorAll("[data-unallow]").forEach(function (x) {
      x.addEventListener("click", function () {
        db.from("scam_allow").delete().eq("number", x.getAttribute("data-unallow")).then(function (r) { if (r.error) throw r.error; done("Back on the scam list"); }).catch(function (e) { toast(e.message, true); });
      });
    });
    b.querySelectorAll("[data-sdel]").forEach(function (x) {
      x.addEventListener("click", function () {
        if (!confirm("Delete every report for " + x.getAttribute("data-sdel") + "?")) return;
        db.from("scam_reports").delete().eq("number", x.getAttribute("data-sdel")).then(function (r) { if (r.error) throw r.error; done("Reports deleted"); }).catch(function (e) { toast(e.message, true); });
      });
    });
  }

  // ---------------------------------------------------------------- caller names
  function namesTab(b) {
    b.innerHTML = '<p class="muted small">Names people chose for their own numbers. ScottPrivacy users see them when that number calls or texts. ' +
      'Remove any name that pretends to be someone else, a company or an official.</p>' +
      '<div class="admin-bar"><input type="search" placeholder="Search number, name or email" data-nsearch></div>' +
      '<div data-nlist></div>';
    var box = b.querySelector("[data-nlist]");
    function draw(q) {
      q = (q || "").toLowerCase();
      var rows = callerNames.filter(function (n) {
        return !q || (n.number + " " + n.name + " " + ((n.profiles || {}).email || "")).toLowerCase().indexOf(q) >= 0;
      });
      box.innerHTML = rows.length ? '<div class="table-wrap"><table class="table admin-table"><thead><tr><th>Number</th><th>Name shown</th><th>Account</th><th>Checked</th><th>Changed</th><th></th></tr></thead><tbody>' +
        rows.map(function (n) {
          return "<tr><td><b>" + esc(n.number) + "</b></td><td>" + esc(n.name) + "</td><td>" + esc((n.profiles || {}).email || "") + "</td><td>" +
            (n.verified ? '<span class="status active">By SMS</span>' : '<span class="muted small">No</span>') + "</td><td>" + fmtAgo(n.updated_at) + "</td>" +
            '<td class="acts"><button type="button" class="link danger" data-ndel="' + esc(n.number) + '">Remove</button></td></tr>';
        }).join("") + "</tbody></table></div>" : '<p class="muted">' + (q ? "Nothing matches." : "Nobody has added a caller name yet.") + "</p>";
      box.querySelectorAll("[data-ndel]").forEach(function (x) {
        x.addEventListener("click", function () {
          var num = x.getAttribute("data-ndel");
          if (!confirm("Remove the caller name for " + num + "?")) return;
          db.from("caller_names").delete().eq("number", num).then(function (r) {
            if (r.error) throw r.error;
            toast("Caller name removed"); loadAll().then(body);
          }).catch(function (e) { toast(e.message, true); });
        });
      });
    }
    b.querySelector("[data-nsearch]").addEventListener("input", function (e) { draw(e.target.value); });
    draw("");
  }

  // ---------------------------------------------------------------- holiday greetings
  // A greeting shows on the website (ribbon at the top), in the app (a card with the poster) and as a phone
  // notification on the morning of its first day, only between its dates, then stops by itself.
  var COUNTRIES = [["KE", "Kenya"], ["UG", "Uganda"], ["TZ", "Tanzania"], ["RW", "Rwanda"], ["NG", "Nigeria"], ["GH", "Ghana"], ["ZA", "South Africa"], ["IN", "India"]];
  var ZONES = [[3, "East Africa (Kenya, Uganda, Tanzania): UTC+3"], [2, "Rwanda, South Africa, Zambia: UTC+2"], [1, "Nigeria: UTC+1"], [0, "Ghana: UTC+0"], [5.5, "India: UTC+5:30"]];
  var PALETTES = [["kenya", "Kenyan flag", ["#000000", "#BB0000", "#006600"], true], ["brand", "ScottPrivacy blue", ["#2F5BEA", "#34D399", "#0B1433"], false],
    ["christmas", "Christmas", ["#C8102E", "#0A7D32", "#F2C14E"], false], ["eid", "Eid", ["#0A7D32", "#F2C14E", "#0B1433"], false],
    ["diwali", "Diwali", ["#FF9933", "#F2C14E", "#7A1FA2"], false], ["uganda", "Ugandan flag", ["#000000", "#FCDC04", "#D90000"], true],
    ["tanzania", "Tanzanian flag", ["#1EB53A", "#000000", "#00A3DD"], true], ["custom", "My own colours", null, false]];

  function today() { return new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10); }   // Kenya time
  function addDays(d, n) { return new Date(new Date(d + "T00:00:00Z").getTime() + n * 864e5).toISOString().slice(0, 10); }
  function dayDiff(a, b) { return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 864e5); }
  function niceDay(d) { return new Date(d + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
  function greetStatus(g) {
    var t = today();
    if (!g.enabled) return '<span class="status suspended">Off</span>';
    if (g.ends_on < t) return '<span class="muted small">Ended</span>';
    if (g.starts_on > t) { var n = dayDiff(t, g.starts_on); return '<span class="status pending">Starts ' + (n === 1 ? "tomorrow" : "in " + n + " days") + "</span>"; }
    return '<span class="status active">Showing now</span>';
  }
  function whoSees(list) {
    if (!list || !list.length) return "Everyone";
    return list.map(function (c) { var f = COUNTRIES.find(function (x) { return x[0] === c; }); return f ? f[1] : c; }).join(", ");
  }
  function posterName(url) { var m = /\/object\/public\/occasions\/(.+)$/.exec(url || ""); return m ? decodeURIComponent(m[1]) : ""; }

  function greetingsTab(b) {
    if (greetErr) {
      b.innerHTML = '<div class="auth-card"><h2>One more step</h2><p class="muted">Greetings need the latest database update. In Supabase open <b>SQL Editor</b>, paste the whole of <code>tools/site/database.sql</code> and press <b>Run</b>, then refresh this page.</p><p class="small muted">' + esc(greetErr.message || "") + "</p></div>";
      return;
    }
    var t = today();
    var now = greetings.filter(function (g) { return g.ends_on >= t; }).sort(function (a, c) { return a.starts_on < c.starts_on ? -1 : 1; });
    var past = greetings.filter(function (g) { return g.ends_on < t; });
    function card(g) {
      return '<article class="greet-card">' +
        (g.poster_url ? '<a href="' + esc(g.poster_url) + '" target="_blank" rel="noopener"><img src="' + esc(g.poster_url) + '" alt="" loading="lazy"></a>' : '<div class="greet-noposter" style="background:linear-gradient(' + (g.colors || []).map(esc).join(",") + ')"></div>') +
        '<div class="greet-info"><div class="greet-stripes">' + (g.colors || []).map(function (c) { return '<i style="background:' + esc(c) + '"></i>'; }).join("") + "</div>" +
        "<b>" + esc(g.title_en) + (g.celebrate !== false && (g.emojis || []).length ? ' <span class="greet-emoji">' + esc(g.emojis.join(" ")) + "</span>" : "") + "</b>" + (g.text_en ? '<p class="small">' + esc(g.text_en) + "</p>" : "") +
        '<p class="sub">' + esc(niceDay(g.starts_on)) + (g.ends_on !== g.starts_on ? " – " + esc(niceDay(g.ends_on)) : "") + " · " + esc(whoSees(g.countries)) + "</p>" +
        '<div class="acts">' + greetStatus(g) +
        '<button type="button" class="link" data-gedit="' + g.id + '">Edit</button>' +
        '<button type="button" class="link" data-gtoggle="' + g.id + '">' + (g.enabled ? "Turn off" : "Turn on") + "</button>" +
        '<button type="button" class="link danger" data-gdel="' + g.id + '">Delete</button></div></div></article>';
    }
    b.innerHTML =
      '<div class="admin-bar"><p class="muted small" style="margin:0;flex:1">Add a message and a poster, pick the days and who sees it. It shows at the top of the website, as a card in the app and as a phone notification on the first morning, then stops by itself after the last day.</p>' +
      '<button class="btn btn-primary btn-small" type="button" data-gnew>+ New greeting</button></div>' +
      "<h3>Showing now and coming up</h3>" + (now.length ? '<div class="greet-list">' + now.map(card).join("") + "</div>" : '<p class="muted">Nothing planned. Press <b>+ New greeting</b> to add one.</p>') +
      (past.length ? '<details class="greet-past"><summary>Past greetings (' + past.length + ")</summary><div class=\"greet-list\">" + past.map(card).join("") + "</div></details>" : "") +
      "<h3>Built in every year</h3><p class='muted small'>These show automatically (from <code>tools/site/occasions.json</code>). A greeting you add here for the same day is shown instead.</p>" +
      '<div class="table-wrap"><table class="table admin-table"><thead><tr><th>Greeting</th><th>When</th><th>Who sees it</th></tr></thead><tbody>' +
      builtIn.map(function (o) {
        var when = (o.yearly || []).map(function (md) { return new Date("2000-" + md + "T12:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "long" }); })
          .concat((o.dates || []).map(niceDay)).join(", ");
        return "<tr><td><b>" + esc((o.title || {}).en || o.id) + "</b></td><td>" + esc(when) + "</td><td>" + esc(whoSees(o.countries)) + "</td></tr>";
      }).join("") + "</tbody></table></div>";

    b.querySelector("[data-gnew]").addEventListener("click", function () { greetingDialog(null); });
    b.querySelectorAll("[data-gedit]").forEach(function (x) {
      x.addEventListener("click", function () { greetingDialog(greetings.find(function (g) { return g.id == x.getAttribute("data-gedit"); })); });
    });
    b.querySelectorAll("[data-gtoggle]").forEach(function (x) {
      x.addEventListener("click", function () {
        var g = greetings.find(function (y) { return y.id == x.getAttribute("data-gtoggle"); });
        db.from("occasions").update({ enabled: !g.enabled }).eq("id", g.id).then(function (r) {
          if (r.error) throw r.error; toast(g.enabled ? "Greeting turned off" : "Greeting turned on"); return loadAll();
        }).then(body).catch(function (e) { toast(e.message, true); });
      });
    });
    b.querySelectorAll("[data-gdel]").forEach(function (x) {
      x.addEventListener("click", function () {
        var g = greetings.find(function (y) { return y.id == x.getAttribute("data-gdel"); });
        if (!confirm('Delete "' + g.title_en + '" and its poster?')) return;
        db.from("occasions").delete().eq("id", g.id).then(function (r) {
          if (r.error) throw r.error;
          var name = posterName(g.poster_url);
          return name ? db.storage.from("occasions").remove([name]) : null;
        }).then(function () { toast("Greeting deleted"); return loadAll(); }).then(body).catch(function (e) { toast(e.message, true); });
      });
    });
  }

  function greetingDialog(g) {
    var editing = !!g, t = today();
    g = g || { title_en: "", title_sw: "", title_fr: "", text_en: "", text_sw: "", text_fr: "", starts_on: t, ends_on: t, countries: ["KE"],
      colors: PALETTES[0][2], flag: true, utc_offset: 3, poster_url: null, enabled: true, celebrate: true, emojis: ["🇰🇪", "🎉", "🌺", "✨"] };
    var chosen = (g.emojis || []).slice(0, 8);
    var pal = PALETTES.find(function (p) { return p[2] && p[2].join() === (g.colors || []).join() && p[3] === !!g.flag; }) || PALETTES[PALETTES.length - 1];
    var d = document.createElement("dialog");
    d.className = "admin-dialog greet-dialog";
    function field(label, name, val, max, area, hint) {
      return "<label>" + label + (area ? '<textarea name="' + name + '" maxlength="' + max + '" rows="2">' + esc(val || "") + "</textarea>"
        : '<input name="' + name + '" maxlength="' + max + '" value="' + esc(val || "") + '">') + (hint ? '<span class="hint">' + hint + "</span>" : "") + "</label>";
    }
    d.innerHTML = '<form class="form" method="dialog" novalidate><h3>' + (editing ? "Edit greeting" : "New greeting") + "</h3>" +
      field("Title (English)", "title_en", g.title_en, 80, false, "Short, like “Happy Mashujaa Day!”") +
      '<div class="row">' + field("Title in Kiswahili", "title_sw", g.title_sw, 80) + field("Title in French", "title_fr", g.title_fr, 80) + "</div>" +
      field("Message (English)", "text_en", g.text_en, 300, true, "One or two sentences. Optional.") +
      '<div class="row">' + field("Message in Kiswahili", "text_sw", g.text_sw, 300, true) + field("Message in French", "text_fr", g.text_fr, 300, true) + "</div>" +
      '<p class="hint" style="margin-top:-6px">Leave a language empty to show the English one.</p>' +
      '<div class="row"><label>First day<input type="date" name="starts_on" value="' + esc(g.starts_on) + '" required></label>' +
      '<label>Last day<input type="date" name="ends_on" value="' + esc(g.ends_on) + '" required><span class="hint">It stops by itself after this day (at most 31 days).</span></label></div>' +
      '<label>Days are counted in<select name="utc_offset">' + ZONES.map(function (z) { return '<option value="' + z[0] + '"' + (Number(g.utc_offset) === z[0] ? " selected" : "") + ">" + z[1] + "</option>"; }).join("") + "</select></label>" +
      '<fieldset class="choice"><legend>Who sees it</legend><label class="check"><input type="radio" name="who" value="all"' + (!g.countries.length ? " checked" : "") + "> Everyone</label>" +
      '<label class="check"><input type="radio" name="who" value="some"' + (g.countries.length ? " checked" : "") + "> Only people in these countries</label>" +
      '<div class="greet-countries" data-countries>' + COUNTRIES.map(function (c) {
        return '<label class="check"><input type="checkbox" value="' + c[0] + '"' + (g.countries.indexOf(c[0]) >= 0 ? " checked" : "") + "> " + c[1] + "</label>";
      }).join("") + "</div>" +
      '<label data-other>Other countries<input name="other" placeholder="Two-letter codes, e.g. ZM, MW" value="' + esc(g.countries.filter(function (c) { return !COUNTRIES.some(function (x) { return x[0] === c; }); }).join(", ")) + '"></label></fieldset>' +
      '<label>Colours<select name="palette">' + PALETTES.map(function (p) { return '<option value="' + p[0] + '"' + (p === pal ? " selected" : "") + ">" + p[1] + "</option>"; }).join("") + "</select></label>" +
      '<div class="greet-colors" data-colors>' + [0, 1, 2].map(function (i) { return '<input type="color" name="c' + i + '" value="' + esc((g.colors || [])[i] || "#2F5BEA") + '" aria-label="Colour ' + (i + 1) + '">'; }).join("") +
      '<label class="check"><input type="checkbox" name="flag"' + (g.flag ? " checked" : "") + "> White lines between the colours (like a flag)</label></div>" +
      '<fieldset class="choice"><legend>Celebration</legend><label class="check"><input type="checkbox" name="celebrate"' + (g.celebrate !== false ? " checked" : "") + "> Flowers, confetti and emojis fly across the screen for a moment</label>" +
      '<div data-celeb><p class="hint">Pick up to 8 emojis (tap again to remove). With none, only flowers and confetti fly.</p><div class="emoji-chosen" data-chosen></div><div class="emoji-pick" data-pick></div></div></fieldset>' +
      '<label>Poster<input type="file" name="poster" accept="image/png,image/jpeg"><span class="hint">PNG or JPG, up to 3 MB. A tall picture (1080 × 1350) looks best.</span></label>' +
      '<div class="greet-preview" data-preview>' + (g.poster_url ? '<img src="' + esc(g.poster_url) + '" alt=""><label class="check"><input type="checkbox" name="noposter"> Remove this poster</label>' : "") + "</div>" +
      '<label class="check"><input type="checkbox" name="enabled"' + (g.enabled ? " checked" : "") + "> Switched on</label>" +
      '<p class="form-status" role="status"></p><div class="dlg-acts"><button type="button" class="btn btn-outline btn-small" data-cancel>Cancel</button>' +
      '<button type="submit" class="btn btn-primary btn-small">' + (editing ? "Save changes" : "Save greeting") + "</button></div></form>";
    document.body.appendChild(d);
    var f = d.querySelector("form"), st = f.querySelector(".form-status");
    function emojiCode(e) { return Array.from(e).map(function (c) { return c.codePointAt(0).toString(16); }).filter(function (h) { return h !== "fe0f"; }).join("-"); }
    function emojiImg(e) { return '<img src="' + window.SP.root + "assets/emoji/" + emojiCode(e) + '.png" alt="' + esc(e) + '" width="30" height="30">'; }
    function drawChosen() {
      d.querySelector("[data-chosen]").innerHTML = chosen.length ? chosen.map(function (e, i) {
        return '<button type="button" class="emoji-chip on" data-unpick="' + i + '" title="Remove">' + emojiImg(e) + "</button>";
      }).join("") : '<span class="muted small">No emojis: flowers and confetti only</span>';
      d.querySelectorAll("[data-unpick]").forEach(function (x) { x.addEventListener("click", function () { chosen.splice(+x.getAttribute("data-unpick"), 1); drawChosen(); }); });
    }
    fetch(window.SP.root + "assets/emoji/list.json").then(function (r) { return r.json(); }).then(function (j) {
      var box = d.querySelector("[data-pick]");
      box.innerHTML = (j.emoji || []).map(function (e) { return '<button type="button" class="emoji-chip" data-e="' + esc(e) + '">' + emojiImg(e) + "</button>"; }).join("");
      box.querySelectorAll("[data-e]").forEach(function (x) {
        x.addEventListener("click", function () {
          var e = x.getAttribute("data-e");
          if (chosen.indexOf(e) >= 0) chosen.splice(chosen.indexOf(e), 1); else if (chosen.length < 8) chosen.push(e);
          drawChosen();
        });
      });
    }).catch(function () { });
    drawChosen();
    f.celebrate.addEventListener("change", function () { d.querySelector("[data-celeb]").hidden = !f.celebrate.checked; });
    d.querySelector("[data-celeb]").hidden = !f.celebrate.checked;
    function syncWho() { var some = f.who.value === "some"; d.querySelector("[data-countries]").hidden = !some; d.querySelector("[data-other]").hidden = !some; }
    function syncPal() {
      var p = PALETTES.find(function (x) { return x[0] === f.palette.value; });
      if (p[2]) { [0, 1, 2].forEach(function (i) { f["c" + i].value = p[2][i]; }); f.flag.checked = p[3]; }
      d.querySelector("[data-colors]").hidden = !!p[2];
    }
    f.querySelectorAll("input[name=who]").forEach(function (r) { r.addEventListener("change", syncWho); });
    f.palette.addEventListener("change", syncPal);
    syncWho(); d.querySelector("[data-colors]").hidden = !!pal[2];
    f.starts_on.addEventListener("change", function () { if (f.ends_on.value < f.starts_on.value) f.ends_on.value = f.starts_on.value; });
    f.poster.addEventListener("change", function () {
      var file = f.poster.files[0], box = d.querySelector("[data-preview]");
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) { st.className = "form-status err"; st.textContent = "The poster is bigger than 3 MB. Save it smaller and try again."; f.poster.value = ""; return; }
      st.textContent = "";
      box.innerHTML = '<img alt="" src="' + URL.createObjectURL(file) + '">';
    });
    d.querySelector("[data-cancel]").addEventListener("click", function () { d.close(); d.remove(); });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = function (m) { st.className = "form-status err"; st.textContent = m; };
      var title = f.title_en.value.trim();
      if (title.length < 2) return err("Write a title in English.");
      if (!f.starts_on.value || !f.ends_on.value) return err("Pick the first and the last day.");
      if (f.ends_on.value < f.starts_on.value) return err("The last day can't be before the first day.");
      if (dayDiff(f.starts_on.value, f.ends_on.value) > 31) return err("A greeting can run for 31 days at most.");
      var countries = [];
      if (f.who.value === "some") {
        d.querySelectorAll("[data-countries] input:checked").forEach(function (c) { countries.push(c.value); });
        f.other.value.toUpperCase().split(/[^A-Z]+/).forEach(function (c) { if (/^[A-Z]{2}$/.test(c) && countries.indexOf(c) < 0) countries.push(c); });
        if (!countries.length) return err("Pick at least one country, or choose Everyone.");
      }
      var row = {
        title_en: title, title_sw: f.title_sw.value.trim() || null, title_fr: f.title_fr.value.trim() || null,
        text_en: f.text_en.value.trim() || null, text_sw: f.text_sw.value.trim() || null, text_fr: f.text_fr.value.trim() || null,
        starts_on: f.starts_on.value, ends_on: f.ends_on.value, utc_offset: Number(f.utc_offset.value), countries: countries,
        colors: [0, 1, 2].map(function (i) { return f["c" + i].value.toUpperCase(); }), flag: f.flag.checked, enabled: f.enabled.checked, celebrate: f.celebrate.checked, emojis: chosen.slice(0, 8)
      };
      var btn = f.querySelector("button[type=submit]"); btn.disabled = true;
      st.className = "form-status"; st.textContent = "Saving…";
      var file = f.poster.files[0], oldPoster = g.poster_url, up = Promise.resolve(f.noposter && f.noposter.checked ? null : oldPoster);
      if (file) {
        var name = "greeting-" + Date.now() + (file.type === "image/png" ? ".png" : ".jpg");
        st.textContent = "Uploading the poster…";
        up = db.storage.from("occasions").upload(name, file, { contentType: file.type, cacheControl: "31536000", upsert: false }).then(function (r) {
          if (r.error) throw r.error;
          return db.storage.from("occasions").getPublicUrl(name).data.publicUrl;
        });
      }
      up.then(function (url) {
        row.poster_url = url || null;
        return editing ? db.from("occasions").update(row).eq("id", g.id) : db.from("occasions").insert(row);
      }).then(function (r) {
        if (r.error) throw r.error;
        if (oldPoster && oldPoster !== row.poster_url && posterName(oldPoster)) db.storage.from("occasions").remove([posterName(oldPoster)]);
        d.close(); d.remove();
        toast(row.starts_on <= today() && row.ends_on >= today() && row.enabled ? "Saved. It's showing now" : "Greeting saved");
        return loadAll();
      }).then(function () { tab = "greetings"; shell(); body(); })
        .catch(function (e2) { err(e2.message || String(e2)); btn.disabled = false; });
    });
    d.showModal();
  }

  // ---------------------------------------------------------------- crash reports
  function crashesTab(b) {
    b.innerHTML = crashes.length ? '<div class="rev-admin">' + crashes.map(function (c) {
      return '<article class="rev-card"><div class="rev-head"><div><b>' + esc(c.device || "Unknown phone") + "</b><span class='sub'>Android " + esc(c.android || "?") +
        " · ScottPrivacy " + esc(c.app_version || "?") + (c.profiles && c.profiles.email ? " · " + esc(c.profiles.email) : "") + "</span></div><time>" + fmtAgo(c.created_at) + "</time></div>" +
        '<details><summary class="small">Show details</summary><pre class="crash">' + esc(c.report) + "</pre></details>" +
        '<div class="acts"><button class="btn btn-outline btn-small danger" data-cdel="' + c.id + '">Delete</button></div></article>';
    }).join("") + "</div>" : '<p class="muted">No crash reports. 🎉</p>';
    b.querySelectorAll("[data-cdel]").forEach(function (x) {
      x.addEventListener("click", function () {
        db.from("crash_reports").delete().eq("id", x.getAttribute("data-cdel")).then(function (r) {
          if (r.error) throw r.error; crashes = crashes.filter(function (c) { return c.id != x.getAttribute("data-cdel"); }); toast("Deleted"); body();
        }).catch(function (e) { toast(e.message, true); });
      });
    });
  }

  // ---------------------------------------------------------------- downloads
  function downloadsTab(b) {
    b.innerHTML = '<div class="admin-bar"><p class="muted small" style="margin:0">Latest ' + downloads.length + ' downloads by signed-in users</p>' +
      '<button class="btn btn-outline btn-small" type="button" data-csv>Export CSV</button></div>' +
      '<div class="table-wrap"><table class="table admin-table"><thead><tr><th>When</th><th>Person</th><th>Version</th></tr></thead><tbody>' +
      downloads.map(function (d) {
        var p = d.profiles || {};
        return "<tr><td>" + new Date(d.created_at).toLocaleString() + "</td><td><b>" + esc(p.full_name || "—") + "</b><span class='sub'>" + esc(p.email || "") + "</span></td><td>" + esc(d.version || "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    $("[data-csv]").addEventListener("click", function () {
      var rows = [["time", "name", "email", "version"]].concat(downloads.map(function (d) {
        var p = d.profiles || {}; return [d.created_at, p.full_name || "", p.email || "", d.version || ""];
      }));
      var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","); }).join("\n");
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = "scottprivacy-downloads.csv"; a.click();
    });
  }

  // ---------------------------------------------------------------- start
  function denied(text) {
    root.innerHTML = '<div class="auth-card"><h2>Admins only</h2><p class="muted">' + text + '</p><a class="btn btn-primary" href="account.html">Go to my account</a></div>';
  }

  document.addEventListener("DOMContentLoaded", function () {
    root = document.getElementById("admin-root");
    if (!root) return;
    if (!A.configured) { denied("Accounts aren't set up yet. Follow tools/site/ACCOUNTS_SETUP.md."); return; }
    A.ready.then(function () {
      db = A.client;
      if (!A.state.user) { A.goSignIn("admin"); return; }
      if (!A.isAdmin()) { denied("Your account doesn't have admin rights."); return; }
      root.innerHTML = '<p class="muted">Loading…</p>';
      // The database only gives admin rights to sessions confirmed with two-step verification.
      db.auth.mfa.getAuthenticatorAssuranceLevel().then(function (r) {
        var l = (r && r.data) || {};
        if (l.currentLevel === "aal2") return loadAll().then(function () { shell(); body(); });
        if (l.nextLevel === "aal2") { location.replace("account.html?next=admin.html"); return; }
        root.innerHTML = '<div class="auth-card"><h2>Turn on two-step verification</h2><p class="muted">To keep users safe, the admin dashboard only opens after you confirm sign-in with a code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…).</p>' +
          '<a class="btn btn-primary" href="account.html#mfa">Set it up in my account</a></div>';
      }).catch(function (e) { denied(esc(e.message)); });
    });
  });
})();
