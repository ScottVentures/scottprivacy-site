/* Accounts for the whole site: one Supabase client, the account button in the header, and the
   "sign in to download / review" rule. Pages use window.SPAuth. Nothing here is a secret: what each
   person may do is enforced by the database rules (tools/site/database.sql). */
(function () {
  "use strict";
  var C = window.SP || {};
  var configured = !!(C.supabaseUrl && C.supabaseKey && window.supabase);
  var client = configured ? window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  }) : null;

  var state = { session: null, user: null, profile: null };
  var listeners = [];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function loadProfile() {
    if (!client || !state.user) { state.profile = null; return Promise.resolve(null); }
    return client.from("profiles").select("*").eq("id", state.user.id).maybeSingle().then(function (r) {
      state.profile = r.data || null;
      return state.profile;
    });
  }

  var ready = !client ? Promise.resolve(state) : client.auth.getSession().then(function (r) {
    state.session = r.data.session;
    state.user = state.session ? state.session.user : null;
    return loadProfile();
  }).then(function () {
    if (state.user) client.rpc("touch_last_seen").then(function () {}, function () {});
    return state;
  }).catch(function () { return state; });

  if (client) {
    client.auth.onAuthStateChange(function (event, session) {
      state.session = session;
      state.user = session ? session.user : null;
      loadProfile().then(function () {
        renderAccountButton();
        listeners.forEach(function (fn) { try { fn(event, state); } catch (e) { } });
      });
    });
  }

  function role() { return state.profile && state.profile.status === "active" ? state.profile.role : (state.profile ? "suspended" : null); }
  function isAdmin() { var r = role(); return r === "admin" || r === "super_admin"; }
  function displayName() {
    if (state.profile && state.profile.full_name) return state.profile.full_name;
    return state.user ? state.user.email : "";
  }

  // ---------------------------------------------------------------- header account button
  function renderAccountButton() {
    var slot = document.querySelector("[data-acct]");
    if (!slot) return;
    var navLink = document.querySelector(".nav-acct");
    if (navLink) { navLink.hidden = !configured; navLink.textContent = state.user ? "My account" : "Sign in"; }
    if (!configured) { slot.hidden = true; return; }
    slot.hidden = false;
    if (!state.user) {
      slot.innerHTML = '<a class="acct-signin" href="account.html">Sign in</a>';
      return;
    }
    var initial = esc((displayName() || "?").trim().charAt(0).toUpperCase());
    slot.innerHTML =
      '<button class="acct-btn" type="button" aria-haspopup="true" aria-expanded="false" title="' + esc(displayName()) + '">' + initial + "</button>" +
      '<div class="acct-menu" role="menu">' +
      '<div class="acct-who"><b>' + esc(displayName()) + "</b><span>" + esc(state.user.email) + "</span>" +
      (isAdmin() ? '<em class="role-badge ' + role() + '">' + (role() === "super_admin" ? "Super admin" : "Admin") + "</em>" : "") + "</div>" +
      '<a role="menuitem" href="account.html">My account</a>' +
      (isAdmin() ? '<a role="menuitem" href="admin.html">Admin dashboard</a>' : "") +
      '<button role="menuitem" type="button" data-signout>Sign out</button></div>';
    var btn = slot.querySelector(".acct-btn");
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = !slot.classList.contains("open");
      slot.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
    slot.querySelector("[data-signout]").addEventListener("click", function () {
      client.auth.signOut().then(function () { location.href = "index.html"; });
    });
  }
  document.addEventListener("click", function () {
    var slot = document.querySelector("[data-acct].open");
    if (slot) slot.classList.remove("open");
  });

  // ---------------------------------------------------------------- sign-in required to download
  function goSignIn(why) {
    var next = location.pathname.split("/").pop() || "index.html";
    location.href = "account.html?why=" + encodeURIComponent(why) + "&next=" + encodeURIComponent(next + location.hash);
  }

  function gateDownloads() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[data-download]");
      if (!a || !configured) return;     // without accounts set up, downloads stay open
      e.preventDefault();
      ready.then(function () {
        if (!state.user) { goSignIn("download"); return; }
        if (role() === "suspended") { alert("Your account is suspended. Contact support if you think this is a mistake."); return; }
        var href = a.href, done = false;
        function go() { if (!done) { done = true; location.href = href; } }
        var version = (document.getElementById("ver") || {}).textContent || "";
        version = (version.match(/\d+(\.\d+)+/) || [""])[0];
        client.from("downloads").insert({ user_id: state.user.id, version: version || null }).then(go, go);
        setTimeout(go, 1500);
      });
    });
  }

  window.SPAuth = {
    configured: configured,
    client: client,
    ready: ready,
    state: state,
    role: role,
    isAdmin: isAdmin,
    displayName: displayName,
    reloadProfile: function () { return loadProfile().then(function (p) { renderAccountButton(); return p; }); },
    onChange: function (fn) { listeners.push(fn); },
    goSignIn: goSignIn,
    esc: esc,
  };

  document.addEventListener("DOMContentLoaded", function () {
    ready.then(renderAccountButton);
    gateDownloads();
  });
})();
