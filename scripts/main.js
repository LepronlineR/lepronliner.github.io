// Shared page behaviour: header state, active nav link, scroll reveal.

function normalizePath(pathname) {
  const trimmed = pathname.endsWith("/index.html") ? pathname.slice(0, -10) : pathname;
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function initHeader() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const currentPath = normalizePath(window.location.pathname);
  header.querySelectorAll(".nav-links a").forEach((link) => {
    const linkPath = normalizePath(new URL(link.href, window.location.href).pathname);
    const isActive = linkPath !== "/" && currentPath.startsWith(linkPath);
    link.classList.toggle("is-active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  const sync = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  sync();
  window.addEventListener("scroll", sync, { passive: true });
}

function initReveal() {
  const targets = document.querySelectorAll(".reveal");
  if (!targets.length || !("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.documentElement.classList.add("js-reveal");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

  targets.forEach((target, index) => {
    // A light stagger for siblings that enter together.
    target.style.transitionDelay = `${Math.min(index % 4, 3) * 60}ms`;
    observer.observe(target);
  });
}

initHeader();
initReveal();
