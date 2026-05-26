const filterButtons = document.querySelectorAll("[data-tag-filters] .tag-filter-button");
const filterStatus = document.querySelector("[data-filter-status]");
const blogCards = document.querySelectorAll(".blog-card[data-tags]");
const activeTags = new Set();

function splitWords(value = "") {
  const words = [];
  let word = "";

  for (const character of value.trim()) {
    if (character === " " || character === "\n" || character === "\r" || character === "\t") {
      if (word) words.push(word);
      word = "";
    } else {
      word += character;
    }
  }

  if (word) words.push(word);
  return words;
}

function enabledTagsFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);
  const repeatedTags = searchParams.getAll("tag");
  const compactTags = splitWords((searchParams.get("tags") || "").split(",").join(" "));
  return [...repeatedTags, ...compactTags].filter(Boolean);
}

function updateFilterUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("tag");
  url.searchParams.delete("tags");
  [...activeTags].sort().forEach((tag) => url.searchParams.append("tag", tag));
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function syncFilter(shouldUpdateUrl = true) {
  if (!filterButtons.length || !blogCards.length) return;

  filterButtons.forEach((button) => {
    const isActive = activeTags.has(button.dataset.tag || "");
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  let visibleCount = 0;
  blogCards.forEach((card) => {
    const cardTags = splitWords(card.dataset.tags || "");
    const isVisible = !activeTags.size || [...activeTags].every((tag) => cardTags.includes(tag));
    card.classList.toggle("is-hidden", !isVisible);
    card.setAttribute("aria-hidden", String(!isVisible));
    if (isVisible) visibleCount += 1;
  });

  if (filterStatus) {
    const filterCount = activeTags.size;
    const postLabel = visibleCount === 1 ? "post" : "posts";
    filterStatus.textContent = filterCount
      ? `${filterCount} ${filterCount === 1 ? "filter" : "filters"}: ${visibleCount} ${postLabel}`
      : `Showing ${visibleCount} ${postLabel}`;
  }

  if (shouldUpdateUrl) updateFilterUrl();
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tag = button.dataset.tag || "";
    if (!tag) return;
    if (activeTags.has(tag)) activeTags.delete(tag);
    else activeTags.add(tag);
    syncFilter();
  });
});

enabledTagsFromUrl().forEach((tag) => activeTags.add(tag));
syncFilter(false);
