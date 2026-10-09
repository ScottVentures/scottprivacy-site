/* Account page: sign in, create an account, reset a password, and manage your own account. */
(function () {
  "use strict";
  var A = window.SPAuth, esc = A.esc;
  var SITE = location.origin + location.pathname.replace(/[^/]*$/, "");
  var params = new URLSearchParams(location.search);
  var root, view = "signin", recovering = false, signingIn = false;

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
    return next && /^((sw|fr)\/)?[a-z0-9_\-]+\.html(#[\w\-]*)?$/i.test(next) ? next : null;
  }
  function afterSignIn() { render(); }

  // ---------------------------------------------------------------- two-step verification (authenticator app codes)
  function mfa() { return A.client.auth.mfa; }
  function needsCode() {
    return mfa().getAuthenticatorAssuranceLevel().then(function (r) {
      var l = (r && r.data) || {};
      return l.nextLevel === "aal2" && l.currentLevel !== "aal2";
    }).catch(function () { return false; });
  }
  function codeField(label) {
    return '<label>' + label + '<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>';
  }
  function codeView() {
    root.innerHTML = '<div class="auth-card"><h2>Two-step verification</h2><p class="muted">Open your authenticator app and enter the 6-digit code for ScottPrivacy.</p>' +
      '<form class="form" novalidate>' + codeField("Code") +
      '<button class="btn btn-primary" type="submit">Verify</button><p class="form-status" role="status" aria-live="polite"></p>' +
      '<p class="muted small"><a href="#" data-out>Sign out</a></p></form></div>';
    var f = $("form"), st = f.querySelector(".form-status"), btn = f.querySelector("button[type=submit]");
    f.code.focus();
    f.querySelector("[data-out]").addEventListener("click", function (e) { e.preventDefault(); A.client.auth.signOut().then(render); });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!f.checkValidity()) { status(st, "err", "Enter the 6 digits from your app."); return; }
      busy(btn, true, "Checking…"); status(st);
      mfa().listFactors().then(function (r) {
        if (r.error) throw r.error;
        var factor = (r.data.totp || [])[0];
        if (!factor) throw new Error("No authenticator is set up for this account.");
        return mfa().challengeAndVerify({ factorId: factor.id, code: f.code.value.trim() });
      }).then(function (r) {
        if (r.error) throw r.error;
        return A.reloadProfile();
      }).then(render).catch(function (err) {
        status(st, "err", /invalid|expired/i.test(err && err.message) ? "That code didn't work. Codes change every 30 seconds, try the newest one." : nice(err));
        busy(btn, false, "Verify");
      });
    });
  }
  function mfaSection(isAdmin) {
    var box = $("#mfa-box");
    mfa().listFactors().then(function (r) {
      if (r.error) throw r.error;
      var on = (r.data.totp || [])[0];
      if (on) {
        box.innerHTML = '<p><b>On.</b> Signing in asks for a code from your authenticator app.</p>' +
          '<button class="btn btn-outline" type="button" data-mfa-off>Turn off</button><p class="form-status" role="status"></p>';
        box.querySelector("[data-mfa-off]").addEventListener("click", function () {
          var warn = isAdmin ? "Turn off two-step verification? You won't be able to open the admin dashboard until you turn it on again." : "Turn off two-step verification?";
          if (!confirm(warn)) return;
          mfa().unenroll({ factorId: on.id }).then(function (x) { if (x.error) throw x.error; return A.client.auth.refreshSession(); })
            .then(render).catch(function (err) { status(box.querySelector(".form-status"), "err", nice(err)); });
        });
      } else {
        box.innerHTML = "<p>" + (isAdmin ? "<b>Needed for the admin dashboard.</b> " : "") +
          "Also ask for a code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…) when you sign in, so a stolen password isn't enough.</p>" +
          '<button class="btn btn-primary" type="button" data-mfa-on>Set up</button><p class="form-status" role="status"></p>';
        box.querySelector("[data-mfa-on]").addEventListener("click", function () { enroll(box); });
      }
    }).catch(function (err) { box.textContent = nice(err); });
  }
  function enroll(box) {
    var st = box.querySelector(".form-status");
    mfa().listFactors().then(function (r) {     // clear setups that were started but never finished
      var stale = ((r.data && r.data.all) || []).filter(function (f) { return f.status !== "verified"; });
      return Promise.all(stale.map(function (f) { return mfa().unenroll({ factorId: f.id }); }));
    }).then(function () {
      return mfa().enroll({ factorType: "totp", friendlyName: "ScottPrivacy " + Date.now().toString(36) });
    }).then(function (r) {
      if (r.error) throw r.error;
      var d = r.data, qr = d.totp.qr_code || "";
      if (qr.indexOf("data:") !== 0) qr = "data:image/svg+xml;utf-8," + encodeURIComponent(qr);
      box.innerHTML = "<p>1. Scan this QR code with your authenticator app.</p>" +
        '<img class="mfa-qr" width="180" height="180" alt="QR code for your authenticator app" src="' + esc(qr) + '">' +
        '<p class="small">Can\'t scan it? Type this key into the app instead: <code class="mfa-key">' + esc(d.totp.secret) + "</code></p>" +
        '<form class="form" novalidate><p>2. Enter the 6-digit code the app shows.</p>' + codeField("Code") +
        '<button class="btn btn-primary" type="submit">Turn on</button><p class="form-status" role="status" aria-live="polite"></p></form>';
      var f = box.querySelector("form"), fst = f.querySelector(".form-status");
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!f.checkValidity()) { status(fst, "err", "Enter the 6 digits from your app."); return; }
        mfa().challengeAndVerify({ factorId: d.id, code: f.code.value.trim() }).then(function (x) {
          if (x.error) throw x.error;
          render();
        }).catch(function (err) { status(fst, "err", /invalid|expired/i.test(err && err.message) ? "That code didn't work. Try the newest one." : nice(err)); });
      });
    }).catch(function (err) { status(st, "err", nice(err)); });
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
      signingIn = true;
      A.client.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value }).then(function (r) {
        if (r.error) throw r.error;
        return A.reloadProfile();
      }).then(afterSignIn).catch(function (err) { status(st, "err", nice(err)); busy(btn, false, "Sign in"); })
        .then(function () { signingIn = false; });
    });
  }

  function signUpForm() {
    return '<form class="form" novalidate>' +
      '<div class="row"><label>Full name<input name="full_name" autocomplete="name" required maxlength="60"></label>' +
      '<label>Country<input name="country" autocomplete="country-name" maxlength="40" placeholder="e.g. Kenya"></label></div>' +
      '<label>Email<input name="email" type="email" autocomplete="email" required></label>' +
      '<label>Password<input name="password" type="password" autocomplete="new-password" required minlength="8"><span class="hint">At least 8 characters.</span></label>' +
      '<label class="check"><input type="checkbox" name="agree" required> I agree to the <a href="privacy.html" target="_blank" rel="noopener noreferrer">privacy policy</a></label>' +
      '<input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<button class="btn btn-primary" type="submit">Create account</button>' +
      '<p class="form-status" role="status" aria-live="polite"></p></form>';
  }
  function bindSignUp(f) {
    var shown = Date.now();
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!f.checkValidity()) { f.reportValidity(); return; }
      var btn = f.querySelector("button[type=submit]"), st = f.querySelector(".form-status");
      if (f.website.value) return;                              // filled in by a robot: the field is invisible to people
      if (Date.now() - shown < 2500) { status(st, "err", "That was quick! Please check your details and press Create account again."); shown = 0; return; }
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
      '<section class="dl-card" id="mfa"><h3>Two-step verification</h3><div id="mfa-box" class="muted">Loading…</div></section>' +
      '<section class="dl-card"><h3>Your review</h3><div id="my-review" class="muted">Loading…</div></section>' +
      '<section class="dl-card"><h3>Your downloads</h3><div id="my-dl" class="muted">Loading…</div></section>' +
      '<section class="dl-card danger"><h3>Delete account</h3><p class="muted">Deletes your account, your review and your download history. This can\'t be undone.</p>' +
      '<button class="btn btn-danger" type="button" data-delete>Delete my account</button><p class="form-status" role="status"></p></section>' +
      "</div></div>";

    mfaSection(r === "super_admin" || r === "admin");
    if (location.hash === "#mfa") setTimeout(function () { var m = $("#mfa"); if (m) m.scrollIntoView(); }, 50);

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
    if (!A.state.user) { authView(); return; }
    needsCode().then(function (need) {
      if (need) codeView();
      else if (nextPage()) location.replace(nextPage());
      else accountView();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    root = document.getElementById("account-root");
    if (!root) return;
    if (params.get("tab") === "signup") view = "signup";
    A.onChange(function (event) {
      if (event === "PASSWORD_RECOVERY") { recovering = true; render(); }
      else if (event === "SIGNED_IN" && params.get("next") && !signingIn) afterSignIn();
      else if (event === "SIGNED_OUT" || event === "USER_UPDATED") render();
    });
    A.ready.then(render);
  });
})();
