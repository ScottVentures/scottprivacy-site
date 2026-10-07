/* Menu, page transitions and small touches shared by every page. */
(function () {
  "use strict";
  var btn = document.querySelector(".menu-btn"), nav = document.getElementById("nav");
  if (btn && nav) {
    function set(open) {
      document.body.classList.toggle("menu-open", open);
      btn.setAttribute("aria-expanded", String(open));
    }
    btn.addEventListener("click", function () { set(!document.body.classList.contains("menu-open")); });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
    window.addEventListener("resize", function () { if (window.innerWidth > 960) set(false); });
  }
  // Header gets a solid background once you scroll.
  var head = document.querySelector(".site-header");
  function onScroll() { if (head) head.classList.toggle("scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  // Fade sections in as they come into view.
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".feature, .pillar, .card, .tile, .rev-card, .faq details, .chip").forEach(function (el) {
      el.classList.add("reveal"); io.observe(el);
    });
  }
})();
