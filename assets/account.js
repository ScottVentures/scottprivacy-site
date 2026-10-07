/* Account page: sign in, create an account, reset a password, and manage your own account. */
(function () {
  "use strict";
  var A = window.SPAuth, esc = A.esc;
  var SITE = location.origin + location.pathname.replace(/[^/]*$/, "");
  var params = new URLSearchParams(location.search);
  var root, view = "signin", recovering = false;

  var WHY = {
    download: "Create a free account or sign in to download ScottPrivacy.",
    review: "Sign in to rate and review ScottPrivacy. One review per person keeps the score honest.",
  };

  function $(s) { return root.querySelector(s); }
  function status(el, kind, text) { el.className = "form-status " + (kind || ""); el.textContent = text || ""; }
  function busy(btn, on, label) { btn.disabled = on; if (label) btn.textContent = label; }
  function nice(err) {
    var m = (err && (err.message || err.error_description || err.error)) || "Something went wrong. Please try again.";
    if (/invalid login/i.test(m)) return "Wrong email or password.";
    if (/email not confirmed/i.test(m)) return "Please confirm your email first: open the link we sent you.";
    if (/already registered/i.test(m)) return "There's already an account with this email. Sign in instead.";
    if (/password should be at least/i.test(m)) return "Use a password with at least 8 characters.";
    if (/rate limit/i.test(m)) return "Too many attempts. Please wait a few minutes and try again.";
    return m;
  }
  function nextPage() {
    var next = params.get("next");
    return next && /^[a-z0-9_\-]+\.html(#[\w\-]*)?$/i.test(next) ? next : null;
  }
  function afterSignIn() {
    if (nextPage()) location.href = nextPage();
    else render();
  }

  // ---------------------------------------------------------------- signed out
  function authView() {
    var why = WHY[params.get("why")];
    root.innerHTML =
      (why ? '<div class="why-note">' + why + "</div>" : "") +
      '<div class="auth-card">' +
      '<div class="auth-tabs" role="tablist">' +
      '<button type="button" role="tab" data-tab="signin" aria-selected="' + (view === "signin") + '">Sign in</button>' +
      '<button type="button" role="tab" data-tab="signup" aria-selected="' + (view === "signup") + '">Create account</button></div>' +
      (view === "signin" ? signInForm() : view === "signup" ? signUpForm() : resetForm()) +
      "</div>";
    root.querySelectorAll("[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () { view = b.getAttribute("data-tab"); authView(); });
    });
    var f = $("form");
    if (view === "signin") bindSignIn(f); else if (view === "signup") bindSignUp(f); else bindReset(f);
  }

  function signInForm() {
    return '<form class="form" novalidate>' +
      '<label>Email<input name="email" type="email" autocomplete="email" required></label>' +
      '<label>Password<input name="password" type="password" autocomplete="current-password" required minlength="8"></label>' +
      '<button class="btn btn-primary" type="submit">Sign in</button>' +
      '<p class="form-status" role="status" aria-live="polite"></p>' +
      '<p class="muted small"><a href="#" data-forgot>Forgot your password?</a></p></form>';
  }
  function bindSignIn(f) {
    f.querySelector("[data-forgot]").addEventListener("click", function (e) { e.preventDefault(); view = "reset"; authView(); });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!f.checkValidity()) { f.reportValidity(); return; }
      var btn = f.querySelector("button[type=submit]"), st = f.querySelector(".form-status");
      busy(btn, true, "Signing in…"); status(st);
      A.client.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value }).then(function (r) {
        if (r.error) throw r.error;
        return A.reloadProfile();
      }).then(afterSignIn).catch(function (err) { status(st, "err", nice(err)); })
        .then(function () { busy(btn, false, "Sign in"); });
    });
  }

  function signUpForm() {
    return '<form class="form" novalidate>' +
      '<div class="row"><label>Full name<input name="full_name" autocomplete="name" required maxlength="60"></label>' +
      '<label>Country<input name="country" autocomplete="country-name" maxlength="40" placeholder="e.g. Kenya"></label></div>' +
      '<label>Email<input name="email" type="email" autocomplete="email" required></label>' +
      '<label>Password<input name="password" type="password" autocomplete="new-password" required minlength="8"><span class="hint">At least 8 characters.</span></label>' +
      '<label class="check"><input type="checkbox" name="agree" required> I agree to the <a href="privacy.html" target="_blank">privacy policy</a></label>' +
      '<button class="btn btn-primary" type="submit">Create account</button>' +
      '<p class="form-status" role="status" aria-live="polite"></p></form>';
  }
  function bindSignUp(f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!f.checkValidity()) { f.reportValidity(); return; }
      var btn = f.querySelector("button[type=submit]"), st = f.querySelector(".form-status");
      busy(btn, true, "Creating…"); status(st);
      var redirect = SITE + "account.html" + (params.get("next") ? "?next=" + encodeURIComponent(params.get("next")) : "");
      A.client.auth.signUp({
        email: f.email.value.trim(), password: f.password.value,
        options: { emailRedirectTo: redirect, data: { full_name: f.full_name.value.trim(), country: f.country.value.trim() } },
      }).then(function (r) {
        if (r.error) throw r.error;
        if (r.data.session) return A.reloadProfile().then(afterSignIn);
        root.innerHTML = '<div class="auth-card done"><div class="done-ic">✓</div><h2>Check your email</h2><p>We sent a link to <b>' +
          esc(f.email.value.trim()) + "</b>. Open it to confirm your account, then you're signed in.</p>" +
          '<p class="muted small">Nothing arrived after a few minutes? Check Spam or Promotions.</p></div>';
      }).catch(function (err) { status(st, "err", nice(err)); busy(btn, false, "Create account"); });
    });
  }

  function resetForm() {
    return '<form class="form" novalidate><p class="muted">Enter your email and we\'ll send you a link to choose a new password.</p>' +
      '<label>Email<input name="email" type="email" autocomplete="email" required></label>' +
      '<button class="btn btn-primary" type="submit">Send reset link</button>' +
      '<p class="form-status" role="status" aria-live="polite"></p>' +
      '<p class="muted small"><a href="#" data-back>Back to sign in</a></p></form>';
  }
  function bindReset(f) {
    f.querySelector("[data-back]").addEventListener("click", function (e) { e.preventDefault(); view = "signin"; authView(); });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!f.checkValidity()) { f.reportValidity(); return; }
      var btn = f.querySelector("button[type=submit]"), st = f.querySelector(".form-status");
      busy(btn, true, "Sending…");
      A.client.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: SITE + "account.html" }).then(function (r) {
        if (r.error) throw r.error;
        status(st, "ok", "If there's an account for that email, a reset link is on its way.");
      }).catch(function (err) { status(st, "err", nice(err)); }).then(function () { busy(btn, false, "Send reset link"); });
    });
  }

  function newPasswordView() {
    root.innerHTML = '<div class="auth-card"><h2>Choose a new password</h2><form class="form" novalidate>' +
      '<label>New password<input name="password" type="password" autocomplete="new-password" required minlength="8"></label>' +
      '<button class="btn btn-primary" type="submit">Save password</button><p class="form-status" role="status"></p></form></div>';
    var f = $("form");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!f.checkValidity()) { f.reportValidity(); return; }
      var st = f.querySelector(".form-status");
      A.client.auth.updateUser({ password: f.password.value }).then(function (r) {
        if (r.error) throw r.error;
        recovering = false;
        status(st, "ok", "Password saved. You're signed in.");
        setTimeout(render, 1200);
      }).catch(function (err) { status(st, "err", nice(err)); });
    });
  }

  // ---------------------------------------------------------------- signed in
  function accountView() {
    var p = A.state.profile || {}, u = A.state.user;
    var r = A.role();
    root.innerHTML =
      '<div class="acct-grid">' +
      '<aside class="dl-card acct-side"><div class="avatar xl">' + esc((A.displayName() || "?").charAt(0).toUpperCase()) + "</div>" +
      "<h2>" + esc(p.full_name || "Your account") + "</h2><p class='muted'>" + esc(u.email) + "</p>" +
      (r === "super_admin" || r === "admin" ? '<span class="role-badge ' + r + '">' + (r === "super_admin" ? "Super admin" : "Admin") + "</span>" : "") +
      (r === "suspended" ? '<span class="role-badge suspended">Suspended</span>' : "") +
      "<p class='muted small'>Member since " + new Date(p.created_at || u.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" }) + "</p>" +
      ((r === "super_admin" || r === "admin") ? '<a class="btn btn-primary" href="admin.html">Open admin dashboard</a>' : '<a class="btn btn-primary" href="download.html">Download the app</a>') +
      '<button class="btn btn-outline" type="button" data-signout>Sign out</button></aside>' +
      '<div class="acct-main">' +
      '<section class="dl-card"><h3>Profile</h3><form class="form" id="f-profile" novalidate><div class="row">' +
      '<label>Full name<input name="full_name" maxlength="60" value="' + esc(p.full_name || "") + '"></label>' +
      '<label>Country<input name="country" maxlength="40" value="' + esc(p.country || "") + '"></label></div>' +
      '<button class="btn btn-primary" type="submit">Save changes</button><p class="form-status" role="status"></p></form></section>' +
      '<section class="dl-card"><h3>Password</h3><form class="form" id="f-pass" novalidate>' +
      '<label>New password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<button class="btn btn-outline" type="submit">Change password</button><p class="form-status" role="status"></p></form></section>' +
      '<section class="dl-card"><h3>Your review</h3><div id="my-review" class="muted">Loading…</div></section>' +
      '<section class="dl-card"><h3>Your downloads</h3><div id="my-dl" class="muted">Loading…</div></section>' +
      '<section class="dl-card danger"><h3>Delete account</h3><p class="muted">Deletes your account, your review and your download history. This can\'t be undone.</p>' +
      '<button class="btn btn-danger" type="button" data-delete>Delete my account</button><p class="form-status" role="status"></p></section>' +
      "</div></div>";

    root.querySelector("[data-signout]").addEventListener("click", function () { A.client.auth.signOut().then(function () { location.href = "index.html"; }); });

    var fp = $("#f-profile");
    fp.addEventListener("submit", function (e) {
      e.preventDefault();
      var st = fp.querySelector(".form-status");
      A.client.from("profiles").update({ full_name: fp.full_name.value.trim() || null, country: fp.country.value.trim() || null }).eq("id", u.id)
        .then(function (res) { if (res.error) throw res.error; return A.reloadProfile(); })
        .then(function () { status(st, "ok", "Saved."); }).catch(function (err) { status(st, "err", nice(err)); });
    });

    var fw = $("#f-pass");
    fw.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!fw.checkValidity()) { fw.reportValidity(); return; }
      var st = fw.querySelector(".form-status");
      A.client.auth.updateUser({ password: fw.password.value }).then(function (res) {
        if (res.error) throw res.error;
        fw.reset(); status(st, "ok", "Password changed.");
      }).catch(function (err) { status(st, "err", nice(err)); });
    });

    A.client.from("reviews").select("stars, comment, approved, updated_at").eq("user_id", u.id).maybeSingle().then(function (res) {
      var box = $("#my-review"), rv = res.data;
      box.innerHTML = rv
        ? "<p><span class='stars-txt'>" + "★★★★★".slice(0, rv.stars) + "<span>" + "★★★★★".slice(rv.stars) + "</span></span> " +
          (rv.comment ? "“" + esc(rv.comment) + "”" : "(stars only)") + "</p><p class='small'>" +
          (rv.comment ? (rv.approved ? "Published on the reviews page." : "Waiting for approval.") : "Counted in the score.") +
          ' <a href="reviews.html#rate">Edit</a></p>'
        : 'You haven\'t rated ScottPrivacy yet. <a href="reviews.html#rate">Rate it now</a>.';
    });

    A.client.from("downloads").select("version, created_at").eq("user_id", u.id).order("created_at", { ascending: false }).limit(10).then(function (res) {
      var rows = res.data || [], box = $("#my-dl");
      box.innerHTML = rows.length
        ? "<ul class='plain'>" + rows.map(function (d) { return "<li>ScottPrivacy " + esc(d.version || "") + " · " + new Date(d.created_at).toLocaleString() + "</li>"; }).join("") + "</ul>"
        : 'No downloads yet. <a href="download.html">Get the app</a>.';
    });

    root.querySelector("[data-delete]").addEventListener("click", function (e) {
      var st = e.target.nextElementSibling;
      if (!confirm("Delete your ScottPrivacy account? This can't be undone.")) return;
      A.client.functions.invoke("admin-users", { body: { action: "delete_me" } }).then(function (res) {
        if (res.error) throw res.error;
        if (res.data && res.data.error) throw new Error(res.data.error);
        return A.client.auth.signOut();
      }).then(function () { location.href = "index.html"; }).catch(function (err) { status(st, "err", nice(err)); });
    });
  }

  function render() {
    if (!A.configured) {
      root.innerHTML = '<div class="auth-card"><h2>Accounts are coming soon</h2><p class="muted">Sign-in isn\'t switched on yet. You can still <a href="download.html">download the app</a>.</p></div>';
      return;
    }
    if (recovering) return newPasswordView();
    if (A.state.user && nextPage()) { location.replace(nextPage()); return; }
    if (A.state.user) accountView(); else authView();
  }

  document.addEventListener("DOMContentLoaded", function () {
    root = document.getElementById("account-root");
    if (!root) return;
    if (params.get("tab") === "signup") view = "signup";
    A.onChange(function (event) {
      if (event === "PASSWORD_RECOVERY") { recovering = true; render(); }
      else if (event === "SIGNED_IN" && params.get("next")) afterSignIn();
      else if (event === "SIGNED_OUT" || event === "USER_UPDATED") render();
    });
    A.ready.then(render);
  });
})();
