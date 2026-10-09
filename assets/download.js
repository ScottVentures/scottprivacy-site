/* Download page: shows the current version, size and checksum. */
(function () {
  "use strict";
  fetch(((window.SP || {}).root || "") + "update/version.json", {cache: "no-store"}).then(function (r) { return r.json(); }).then(function (v) {
    if (!v || !v.version_name) return;
    var mb = v.size ? " · " + (v.size / 1048576).toFixed(0) + " MB" : "";
    document.getElementById("ver").textContent = (window.SP && SP.t ? SP.t("Version") : "Version") + " " + v.version_name + mb;
    if (v.sha256 && !/^0+$/.test(v.sha256)) document.getElementById("sha").textContent = v.sha256;
  }).catch(function () {});
})();
