/* ScottPrivacy download dashboard. History comes from stats/downloads.json (written once a day by the
   Publish website GitHub Action); the per-version numbers are read live from GitHub's public API. */
(function () {
  "use strict";
  var REPO = "ScottVentures/scottprivacy-site";
  var NS = "http://www.w3.org/2000/svg";
  function $(id) { return document.getElementById(id); }
  function fmt(n) { return Number(n || 0).toLocaleString(); }
  function svg(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function niceMax(v) {
    if (v <= 5) return 5;
    var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }
  function shortDate(s) {
    var d = new Date(s + "T00:00:00");
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  function lineChart(box, pts) {
    box.innerHTML = "";
    if (pts.length < 2) { box.innerHTML = "<div class='empty'>The graph starts once there are two days of data. The website records the total every day.</div>"; return; }
    var W = 760, H = 280, L = 52, R = 16, T = 14, B = 34;
    var max = niceMax(Math.max.apply(null, pts.map(function (p) { return p.v; })));
    var x = function (i) { return L + (W - L - R) * i / (pts.length - 1); };
    var y = function (v) { return T + (H - T - B) * (1 - v / max); };
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Total downloads over time" }, box);
    var g = svg("g", { "class": "grid" }, s), ax = svg("g", { "class": "axis" }, s);
    for (var i = 0; i <= 4; i++) {
      var v = max * i / 4, yy = y(v);
      svg("line", { x1: L, x2: W - R, y1: yy, y2: yy }, g);
      var t = svg("text", { x: L - 8, y: yy + 4, "text-anchor": "end" }, ax); t.textContent = fmt(Math.round(v));
    }
    var step = Math.max(1, Math.ceil(pts.length / 6));
    pts.forEach(function (p, i) {
      if (i % step && i !== pts.length - 1) return;
      var t = svg("text", { x: x(i), y: H - 10, "text-anchor": i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle" }, ax);
      t.textContent = shortDate(p.d);
    });
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.v).toFixed(1); }).join(" ");
    svg("path", { "class": "area", d: d + " L" + x(pts.length - 1) + " " + y(0) + " L" + x(0) + " " + y(0) + " Z" }, s);
    svg("path", { "class": "line", d: d }, s);
    var cross = svg("line", { "class": "cross", y1: T, y2: H - B, x1: -10, x2: -10 }, s);
    var dot = svg("circle", { "class": "pt", r: 5, cx: -10, cy: -10 }, s);
    var tip = document.createElement("div"); tip.className = "tip"; box.appendChild(tip);
    var hit = svg("rect", { x: L, y: T, width: W - L - R, height: H - T - B, fill: "transparent" }, s);
    function show(ev) {
      var r = s.getBoundingClientRect(), px = (ev.clientX - r.left) * W / r.width;
      var i = Math.max(0, Math.min(pts.length - 1, Math.round((px - L) / (W - L - R) * (pts.length - 1))));
      var cx = x(i), cy = y(pts[i].v);
      cross.setAttribute("x1", cx); cross.setAttribute("x2", cx);
      dot.setAttribute("cx", cx); dot.setAttribute("cy", cy);
      tip.innerHTML = "<b>" + fmt(pts[i].v) + "</b> downloads<br>" + shortDate(pts[i].d);
      tip.style.left = (cx * r.width / W) + "px"; tip.style.top = (cy * r.height / H) + "px"; tip.style.opacity = 1;
    }
    hit.addEventListener("pointermove", show);
    hit.addEventListener("pointerleave", function () { tip.style.opacity = 0; cross.setAttribute("x1", -10); cross.setAttribute("x2", -10); dot.setAttribute("cx", -10); });
  }

  function barChart(box, rows) {
    box.innerHTML = "";
    if (!rows.length) { box.innerHTML = "<div class='empty'>No releases yet. Publish the first APK as a GitHub Release and its downloads appear here.</div>"; return; }
    var W = 760, rowH = 34, L = 90, R = 70, H = rows.length * rowH + 8;
    var max = Math.max(1, Math.max.apply(null, rows.map(function (r) { return r.n; })));
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Downloads per version" }, box);
    var ax = svg("g", { "class": "axis" }, s);
    var tip = document.createElement("div"); tip.className = "tip"; box.appendChild(tip);
    rows.forEach(function (r, i) {
      var yy = i * rowH + 4, w = Math.max(4, (W - L - R) * r.n / max);
      var t = svg("text", { x: L - 10, y: yy + 19, "text-anchor": "end" }, ax); t.textContent = r.v;
      var b = svg("rect", { "class": "bar", x: L, y: yy + 4, width: w, height: rowH - 12, rx: 4 }, s);
      var n = svg("text", { x: L + w + 8, y: yy + 19 }, ax); n.textContent = fmt(r.n);
      b.addEventListener("pointermove", function (ev) {
        var rr = s.getBoundingClientRect();
        tip.innerHTML = "<b>" + r.v + "</b><br>" + fmt(r.n) + " downloads" + (r.date ? "<br>Released " + shortDate(r.date) : "");
        tip.style.left = ((ev.clientX - rr.left)) + "px"; tip.style.top = ((yy + 4) * rr.height / H) + "px"; tip.style.opacity = 1;
      });
      b.addEventListener("pointerleave", function () { tip.style.opacity = 0; });
    });
  }

  function table(id, head, rows) {
    var t = $(id);
    if (!t) return;
    t.innerHTML = "<thead><tr>" + head.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody>";
  }

  function render(history, releases) {
    var days = (history && history.days) || [];
    var vers = releases.map(function (r) {
      var n = 0;
      (r.assets || []).forEach(function (a) { if (/\.apk$/i.test(a.name)) n += a.download_count; });
      return { v: r.tag_name, n: n, date: (r.published_at || "").slice(0, 10) };
    });
    var total = vers.reduce(function (a, r) { return a + r.n; }, 0);
    if (!vers.length && days.length) total = days[days.length - 1].total;
    $("t-total").textContent = fmt(total);
    $("t-latest").textContent = vers.length ? fmt(vers[0].n) : "–";
    $("t-latest-sub").textContent = vers.length ? vers[0].v : "No release yet";
    var weekAgo = days.length ? days.filter(function (d) { return (Date.now() - new Date(d.date + "T00:00:00")) <= 7.5 * 864e5; })[0] : null;
    var lastDay = days[days.length - 1];
    $("t-week").textContent = weekAgo && lastDay && lastDay !== weekAgo ? fmt(Math.max(0, lastDay.total - weekAgo.total)) : "–";
    $("t-versions").textContent = fmt(vers.length);
    var pts = days.map(function (d) { return { d: d.date, v: d.total }; });
    lineChart($("c-total"), pts);
    barChart($("c-versions"), vers.slice(0, 12));
    table("tb-total", ["Date", "Total downloads"], days.slice().reverse().map(function (d) { return [d.date, fmt(d.total)]; }));
    table("tb-versions", ["Version", "Released", "Downloads"], vers.map(function (r) { return [r.v, r.date, fmt(r.n)]; }));
    $("updated").textContent = "Live from GitHub · history recorded daily" + (history && history.updated ? " (last " + history.updated + ")" : "");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var hist = fetch("stats/downloads.json", { cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return { days: [] }; });
    var rel = fetch("https://api.github.com/repos/" + REPO + "/releases?per_page=100").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
    Promise.all([hist, rel]).then(function (v) { render(v[0], Array.isArray(v[1]) ? v[1] : []); });
  });
})();
