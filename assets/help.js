/* ScottPrivacy help: an instant-answer assistant (works in the browser, no server, nothing sent) and the
   support form. The assistant matches questions against the answers below; anything it can't answer goes
   to the support form. Edit KB to add answers. */
(function () {
  "use strict";

  // ---------------------------------------------------------------- knowledge base
  var KB = [
    { q: "How do I install ScottPrivacy?", k: "install download apk setup how get sakinisha pakua phone",
      a: "Tap <b>Download APK</b> on the <a href='download.html#install'>download page</a>, open the file, allow installs from your browser when Android asks, then tap <b>Install</b>." },
    { q: "It says \"App not installed\" or \"conflicts with an existing package\"", k: "app not installed conflict existing package error failed install haikusakinishwa signature",
      a: "An older copy of ScottPrivacy from somewhere else (another website, Palm Store or a test build) is already on the phone. Uninstall it first, then install again. Copies from different places can't replace each other." },
    { q: "Play Protect blocked the app", k: "play protect blocked block blocking cannot install harmful fraud protection sensitive sms permission imezuiwa",
      a: "Download the latest version from the <a href='download.html'>download page</a>. It leaves out SMS reading, which is what Play Protect blocks in apps installed from a website. Automatic scam SMS filtering is in the full version from Palm Store and Google Play." },
    { q: "Play Protect warns me about the app", k: "play protect warning unsafe harmful unknown developer blocked virus",
      a: "That's normal for apps installed from a website instead of Google Play. Tap <b>More details › Install anyway</b>. Only download ScottPrivacy from this website." },
    { q: "Why does it want to be my Phone or SMS app?", k: "default phone app sms app messages why role dialer default sms permission",
      a: "Android only lets the Phone app block calls and show a warning screen, and only the SMS app can move scam texts to Spam. Your messages and call history stay on your phone, and you can switch back any time." },
    { q: "How do I switch back to my old SMS or Phone app?", k: "switch back old sms app phone app default undo remove change default apps",
      a: "Open Android <b>Settings › Apps › Default apps</b> and choose your old SMS or Phone app. Nothing is lost." },
    { q: "The call screen opens late or not at all", k: "call screen slow late not showing incoming call battery tecno infinix itel xiaomi samsung autostart background",
      a: "Phones like Tecno, Infinix, itel and Xiaomi close apps in the background. In ScottPrivacy open <b>Blocking</b> and tap <b>Fix now</b>: it shows which battery and auto-start settings to change." },
    { q: "A real message went to Spam", k: "wrong spam real message not spam mistake false missing message",
      a: "Open the Spam folder, open the conversation and tap <b>Not spam</b>. Messages from that sender stay in your inbox from then on." },
    { q: "How do I block a number?", k: "block number caller block list stop calls series country code sender",
      a: "Open <b>Blocking</b> and tap <b>Block list</b>, or open the call or message and tap <b>Block</b>. You can also block whole number series (like 0799*) and country codes." },
    { q: "How do updates work?", k: "update new version upgrade latest check for updates",
      a: "Once a day the app checks this website. When there's a new version it asks you, downloads it, checks it, and Android asks you to confirm. You can also tap <b>Settings › Check for updates</b>." },
    { q: "Is ScottPrivacy free?", k: "free price cost pay money subscription pro ads",
      a: "Yes. You can download and use ScottPrivacy for free, and there are no ads." },
    { q: "Does it upload my messages or contacts?", k: "privacy data upload send server safe messages contacts spy track",
      a: "No. Calls, messages, contacts and files are checked on your phone and never uploaded. See the <a href='privacy.html'>privacy policy</a> for the few things the app downloads." },
    { q: "How do I delete my data?", k: "delete data erase remove personal data uninstall account",
      a: "In the app open <b>Settings › Erase personal data</b>, or uninstall the app. We don't keep a copy, so there's nothing to delete on our side." },
    { q: "Which languages and countries does it support?", k: "language swahili kiswahili hindi french english country india uganda tanzania nigeria works abroad",
      a: "The app speaks English, Kiswahili, हिन्दी and Français (<b>Settings › Language</b>). It works in every country: it reads your country from the SIM, and you can change it in <b>Settings › Your country</b>." },
    { q: "What is Code guard?", k: "code guard otp code call warning pin share",
      a: "If a one-time code arrives while you're on a call, ScottPrivacy warns you loudly not to read it out. Real companies never ask for that code." },
    { q: "Is the cleaner safe? Will it delete my photos?", k: "cleaner delete photos files junk duplicate safe storage space",
      a: "It only scans folders you choose and deletes nothing until you confirm. For duplicates it always keeps the oldest copy." },
    { q: "Someone sent me money \"by mistake\". What do I do?", k: "money sent by mistake reverse refund return mpesa wrong number nimekosea rudisha",
      a: "Don't send anything back yourself. Check your real balance in your M-PESA, MoMo or bank app. If the money truly arrived, the sender's provider can reverse it." },
    { q: "Which phones does it work on?", k: "phone android version supported old phone requirements 32 bit",
      a: "Any phone with Android 7 or newer, including Tecno, Infinix, itel, Samsung, Xiaomi and Nokia." },
    { q: "Can I get it on Palm Store?", k: "palm store tecno infinix itel store play store google play",
      a: "Yes, ScottPrivacy is coming to Palm Store on Tecno, Infinix and itel phones. A Palm Store copy and a copy from this website can't update each other, so uninstall one before installing the other." },
  ];

  var STOP = " a an the i my me to it is of in on for and or do does can how what why when is it's it is with this that be am are was not no yes you your".split(" ");
  function words(s) {
    return (s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9ऀ-ॿ]+/g) || [])
      .filter(function (w) { return w.length > 1 && STOP.indexOf(w) < 0; });
  }
  function score(query, item) {
    var q = words(query), hay = words(item.q + " " + item.k), s = 0;
    q.forEach(function (w) {
      hay.forEach(function (h) {
        if (h === w) s += 3;
        else if (w.length > 3 && (h.indexOf(w) === 0 || w.indexOf(h) === 0) && Math.min(h.length, w.length) > 3) s += 1.5;
      });
    });
    return s / Math.sqrt(q.length || 1);
  }
  function ask(query) {
    return KB.map(function (it) { return { it: it, s: score(query, it) }; })
      .filter(function (r) { return r.s >= 2; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 3).map(function (r) { return r.it; });
  }

  // ---------------------------------------------------------------- assistant UI
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function mountAssistant(box, compact) {
    var log = el("div", "hb-log");
    var form = el("form", "hb-ask");
    var input = el("input");
    input.type = "text"; input.placeholder = "Ask a question, e.g. \"app not installed\""; input.setAttribute("aria-label", "Your question");
    var btn = el("button", "btn btn-primary btn-small", "Ask");
    btn.type = "submit";
    form.appendChild(input); form.appendChild(btn);

    function bot(html) { var m = el("div", "hb-msg bot", html); log.appendChild(m); log.scrollTop = log.scrollHeight; return m; }
    function me(text) { var m = el("div", "hb-msg me"); m.textContent = text; log.appendChild(m); log.scrollTop = log.scrollHeight; }
    function suggest(list) {
      var row = el("div", "hb-chips");
      list.forEach(function (it) {
        var c = el("button", "hb-chip"); c.type = "button"; c.textContent = it.q;
        c.onclick = function () { me(it.q); bot(it.a + follow()); };
        row.appendChild(c);
      });
      log.appendChild(row);
    }
    function follow() { return "<div class='hb-more'>Still stuck? <a href='support.html#form'>Send us a message</a>.</div>"; }

    bot("Hi! I can answer common questions about ScottPrivacy straight away. What do you need help with?");
    suggest([KB[0], KB[1], KB[5], KB[3]]);

    form.onsubmit = function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q) return;
      me(q);
      input.value = "";
      var hits = ask(q);
      if (!hits.length) {
        bot("I don't have an answer for that yet. <a href='support.html#form'>Send us a message</a> and we'll get back to you by email.");
        return;
      }
      bot("<b>" + hits[0].q + "</b><br>" + hits[0].a + follow());
      if (hits.length > 1) { bot("Related:"); suggest(hits.slice(1)); }
    };
    box.appendChild(log);
    box.appendChild(form);
    if (!compact) input.focus({ preventScroll: true });
  }

  // Floating "Help" button on every page except the support page (which has the assistant built in).
  function floating() {
    if (document.getElementById("assistant")) return;
    var fab = el("button", "hb-fab", "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4.2A2.5 2.5 0 0 1 4 13.5z'/></svg><span>Help</span>");
    fab.type = "button"; fab.setAttribute("aria-expanded", "false");
    var panel = el("div", "hb-panel");
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "ScottPrivacy help");
    var head = el("div", "hb-head", "<b>ScottPrivacy help</b><span>Instant answers</span>");
    var close = el("button", "hb-close", "×"); close.type = "button"; close.setAttribute("aria-label", "Close help");
    head.appendChild(close);
    panel.appendChild(head);
    var body = el("div", "hb-body");
    panel.appendChild(body);
    var mounted = false;
    function toggle(open) {
      panel.classList.toggle("open", open);
      fab.setAttribute("aria-expanded", String(open));
      if (open && !mounted) { mountAssistant(body, false); mounted = true; }
    }
    fab.onclick = function () { toggle(!panel.classList.contains("open")); };
    close.onclick = function () { toggle(false); };
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") toggle(false); });
    document.body.appendChild(panel);
    document.body.appendChild(fab);
  }

  // ---------------------------------------------------------------- support form
  function supportForm() {
    var f = document.getElementById("support-form");
    if (!f) return;
    var key = f.getAttribute("data-key") || "";
    var status = document.getElementById("form-status");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!f.checkValidity()) { f.reportValidity(); return; }
      if (f.botcheck && f.botcheck.checked) return;
      var data = {
        subject: "ScottPrivacy support: " + f.topic.value,
        from_name: f.name.value || "ScottPrivacy user",
        name: f.name.value, email: f.email.value, topic: f.topic.value,
        phone: f.phone.value, rating: f.rating ? (f.querySelector("input[name=rating]:checked") || {}).value || "" : "",
        message: f.message.value,
      };
      if (!key || key.indexOf("YOUR_") === 0) {
        // Not set up yet: fall back to the visitor's email app.
        var body = "Topic: " + data.topic + "\nPhone: " + data.phone + "\n\n" + data.message;
        location.href = "mailto:" + f.getAttribute("data-fallback") + "?subject=" + encodeURIComponent(data.subject) + "&body=" + encodeURIComponent(body);
        return;
      }
      data.access_key = key;
      var btn = f.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = "Sending…";
      status.className = "form-status"; status.textContent = "";
      fetch("https://api.web3forms.com/submit", {
        method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(data),
      }).then(function (r) { return r.json(); }).then(function (r) {
        if (!r.success) throw new Error(r.message || "failed");
        f.reset();
        status.className = "form-status ok";
        status.textContent = "Thanks! Your message has been sent. We'll reply to " + data.email + ".";
      }).catch(function () {
        status.className = "form-status err";
        status.textContent = "Sorry, your message couldn't be sent. Check your internet connection and try again.";
      }).finally(function () { btn.disabled = false; btn.textContent = "Send message"; });
    });
  }

  // ---------------------------------------------------------------- download counter (shown once it's worth showing)
  function counter() {
    var slot = document.querySelector("[data-downloads]");
    if (!slot) return;
    fetch("stats/downloads.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      var last = d && d.days && d.days[d.days.length - 1];
      var n = last ? last.total : 0;
      var min = parseInt(slot.getAttribute("data-downloads"), 10) || 1000;
      if (n >= min) {
        slot.textContent = (n >= 10000 ? Math.floor(n / 1000) + "k" : n.toLocaleString()) + "+ downloads";
        slot.hidden = false;
      }
    }).catch(function () {});
  }

  document.addEventListener("DOMContentLoaded", function () {
    var a = document.getElementById("assistant");
    if (a) mountAssistant(a, true);
    floating();
    supportForm();
    counter();
  });
})();
