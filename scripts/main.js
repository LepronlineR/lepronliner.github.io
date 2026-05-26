const siteHeader = document.querySelector(".site-header");
const navLinks = document.querySelectorAll(".nav-links a");

function normalizeIndexPath(pathname) {
  return pathname.endsWith("/index.html") ? pathname.slice(0, -10) || "/" : pathname;
}

function initTopbar() {
  if (!siteHeader) return;

  const currentPath = normalizeIndexPath(window.location.pathname);
  navLinks.forEach((link) => {
    const href = new URL(link.href, window.location.href);
    const hrefPath = normalizeIndexPath(href.pathname);
    const isActive = hrefPath === "/" ? currentPath === "/" : currentPath.startsWith(hrefPath);
    link.classList.toggle("is-active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  function syncHeaderState() {
    siteHeader.classList.toggle("is-scrolled", window.scrollY > 12);
  }

  syncHeaderState();
  window.addEventListener("scroll", syncHeaderState, { passive: true });
}

async function loadLatestPosts() {
  const rail = document.querySelector("#latest-posts");
  if (!rail) return;

  try {
    const response = await fetch("/blog/posts.json", { cache: "no-store" });
    if (!response.ok) return;
    const posts = await response.json();
    rail.innerHTML = posts.slice(0, 3).map((post) => `
      <a class="rail-post" href="${post.url}">
        <span>${post.title}</span>
        <small>${post.description || post.tags.join(", ")}</small>
      </a>
    `).join("");
  } catch {
    // The static fallback stays in the markup for file previews.
  }
}

initTopbar();
loadLatestPosts();
