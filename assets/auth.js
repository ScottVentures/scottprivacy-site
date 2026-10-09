/* Accounts for the whole site: one Supabase client, the account button in the header, and the
   "sign in to download / review" rule. Pages use window.SPAuth. Nothing here is a secret: what each
   person may do is enforced by the database rules (tools/site/database.sql). */
(function () {
  "use strict";
  var C = window.SP || {};
  var configured = !!(C.supabaseUrl && C.supabaseKey);
  var client = null;

  // The sign-in library (~190 KB) loads only where it's needed: the account, admin, reviews and download pages,
  // a page opened from an email link, or any page when someone is already signed in.
  var NEEDS = /^(account|admin|reviews|download)\.html$/;
  function hasSession() {
    try {
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^sb-.*-auth-token$/.test(k)) return true; }
    } catch (e) { }
    return false;
  }
  var page = (document.body && document.body.getAttribute("data-page")) || location.pathname.split("/").pop() || "index.html";
  var wanted = configured && (NEEDS.test(page) || hasSession() || /access_token=|type=recovery|code=/.test(location.hash + location.search));
  var root = (window.SP && SP.root) || "";
  var base = (document.currentScript && document.currentScript.src || "").replace(/auth\.js.*$/, "");
  var libReady = !wanted ? Promise.resolve(false) : (window.supabase ? Promise.resolve(true) : new Promise(function (res) {
    var sc = document.createElement("script");
    sc.src = base + "vendor/supabase.js";
    sc.onload = function () { res(true); };
    sc.onerror = function () { res(false); };
    document.head.appendChild(sc);
  }));
  function loadLib() {
    if (!configured) return Promise.resolve(null);
    if (client) return Promise.resolve(client);
    if (!wanted) {   // a page that didn't need it after all (e.g. a Download button on the home page)
      wanted = true;
      libReady = new Promise(function (res) {
        var sc = document.createElement("script");
        sc.src = base + "vendor/supabase.js";
        sc.onload = function () { res(true); };
        sc.onerror = function () { res(false); };
        document.head.appendChild(sc);
      });
    }
    return libReady.then(function (ok) {
      if (ok && window.supabase && !client) {
        client = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        client.auth.onAuthStateChange(function (event, session) {
          state.session = session;
          state.user = session ? session.user : null;
          loadProfile().then(function () {
            renderAccountButton();
            listeners.forEach(function (fn) { try { fn(event, state); } catch (e) { } });
          });
        });
      }
      return client;
    });
  }

  var state = { session: null, user: null, profile: null };
  var listeners = [];

  function t(x) { return window.SP && SP.t ? SP.t(x) : x; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function loadProfile() {
    if (!client || !state.user) { state.profile = null; return Promise.resolve(null); }
    return client.from("profiles").select("*").eq("id", state.user.id).maybeSingle().then(function (r) {
      state.profile = r.data || null;
      return state.profile;
    });
  }

  var ready = !wanted ? Promise.resolve(state) : loadLib().then(function (c) {
    if (!c) return state;
    return c.auth.getSession().then(function (r) {
      state.session = r.data.session;
      state.user = state.session ? state.session.user : null;
      return loadProfile();
    }).then(function () {
      if (state.user) c.rpc("touch_last_seen").then(function () {}, function () {});
      return state;
    });
  }).catch(function () { return state; });

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
    if (navLink) { navLink.hidden = !configured; navLink.textContent = t(state.user ? "My account" : "Sign in"); }
    if (!configured) { slot.hidden = true; return; }
    slot.hidden = false;
    if (!state.user) {
      slot.innerHTML = '<a class="acct-signin" href="' + root + 'account.html">' + t("Sign in") + '</a>';
      return;
    }
    var initial = esc((displayName() || "?").trim().charAt(0).toUpperCase());
    slot.innerHTML =
      '<button class="acct-btn" type="button" aria-haspopup="true" aria-expanded="false" title="' + esc(displayName()) + '">' + initial + "</button>" +
      '<div class="acct-menu" role="menu">' +
      '<div class="acct-who"><b>' + esc(displayName()) + "</b><span>" + esc(state.user.email) + "</span>" +
      (isAdmin() ? '<em class="role-badge ' + role() + '">' + t(role() === "super_admin" ? "Super admin" : "Admin") + "</em>" : "") + "</div>" +
      '<a role="menuitem" href="' + root + 'account.html">' + t("My account") + '</a>' +
      (isAdmin() ? '<a role="menuitem" href="' + root + 'admin.html">' + t("Admin dashboard") + '</a>' : "") +
      '<button role="menuitem" type="button" data-signout>' + t("Sign out") + '</button></div>';
    var btn = slot.querySelector(".acct-btn");
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = !slot.classList.contains("open");
      slot.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
    slot.querySelector("[data-signout]").addEventListener("click", function () {
      client.auth.signOut().then(function () { location.href = root + "index.html"; });
    });
  }
  document.addEventListener("click", function () {
    var slot = document.querySelector("[data-acct].open");
    if (slot) slot.classList.remove("open");
  });

  // ---------------------------------------------------------------- sign-in required to download
  function goSignIn(why) {
    var next = location.pathname.split("/").pop() || "index.html";
    var dir = document.documentElement.lang !== "en" ? document.documentElement.lang + "/" : "";
    location.href = root + "account.html?why=" + encodeURIComponent(why) + "&next=" + encodeURIComponent(dir + next + location.hash);
  }

  function gateDownloads() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[data-download]");
      if (!a || !configured) return;     // without accounts set up, downloads stay open
      e.preventDefault();
      loadLib().then(function () { return client && !state.session ? client.auth.getSession().then(function (r) {
        state.session = r.data.session; state.user = state.session ? state.session.user : null; return loadProfile();
      }) : null; }).then(function () { return ready; }).then(function () {
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
    get client() { return client; },
    load: loadLib,
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
