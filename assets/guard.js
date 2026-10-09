/* Stops other websites showing these pages inside a frame (clickjacking). GitHub Pages can't send the
   frame-ancestors header, so the page hides itself and opens on its own instead. */
(function () {
  if (window.self === window.top) return;
  document.documentElement.style.display = "none";
  try { window.top.location.replace(window.self.location.href); } catch (e) { /* cross-origin: stays hidden */ }
})();
