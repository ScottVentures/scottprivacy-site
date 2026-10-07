/* Admin dashboard. Every action is checked again by the database or the admin-users function, so
   hiding buttons here is only for convenience, not security. */
(function () {
  "use strict";
  var A = window.SPAuth, esc = A.esc, db;
  var root, tab = "overview", users = [], reviews = [], downloads = [], filter = { q: "", role: "", status: "", rev: "pending" };
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
    ]).then(function (r) {
      users = r[0].data || []; reviews = r[1].data || []; downloads = r[2].data || [];
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
      ["overview:Overview", "users:Users", "reviews:Reviews", "downloads:Downloads"].map(function (t) {
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
        ["Reviews to check", o.pending_reviews, o.pending_reviews ? "Waiting for approval" : "All caught up"], ["Suspended", o.suspended, "Accounts blocked"]];
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
    db = A.client;
    A.ready.then(function () {
      if (!A.state.user) { A.goSignIn("admin"); return; }
      if (!A.isAdmin()) { denied("Your account doesn't have admin rights."); return; }
      root.innerHTML = '<p class="muted">Loading…</p>';
      loadAll().then(function () { shell(); body(); }).catch(function (e) { denied(esc(e.message)); });
    });
  });
})();
