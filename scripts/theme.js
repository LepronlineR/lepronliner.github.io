(function () {
  const button = document.querySelector("[data-theme-toggle]");
  const body = document.body;
  if (!button || !body) return;
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const storageKey = "siteTheme";

  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    body.classList.toggle("theme-dark", isDark);
    button.classList.toggle("is-dark", isDark);
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("title", isDark ? "Use light theme" : "Use dark theme");
  }

  const storedTheme = localStorage.getItem(storageKey) || localStorage.getItem("blogTheme");
  const preferredTheme = mediaQuery.matches ? "dark" : "light";
  applyTheme(storedTheme || preferredTheme);

  button.addEventListener("click", () => {
    const nextTheme = body.classList.contains("theme-dark") ? "light" : "dark";
    localStorage.setItem(storageKey, nextTheme);
    applyTheme(nextTheme);
  });

  mediaQuery.addEventListener("change", (event) => {
    if (localStorage.getItem(storageKey)) return;
    applyTheme(event.matches ? "dark" : "light");
  });
})();
