(() => {
  const form = document.querySelector("[data-product-search]");
  const input = document.querySelector("[data-product-search-input]");
  const clearButton = document.querySelector("[data-product-search-clear]");
  const status = document.querySelector("[data-product-search-status]");
  const productSection = document.querySelector("#produk");
  const cards = Array.from(document.querySelectorAll("#produk .product-card"));

  if (!form || !input || !status || !cards.length) return;

  const normalize = (value) => value
    .toLocaleLowerCase("id-ID")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const applySearch = (value, scrollToResults = false) => {
    const query = normalize(value);
    let visibleCount = 0;

    for (const card of cards) {
      const matches = !query || normalize(card.textContent).includes(query);
      card.hidden = !matches;
      if (matches) visibleCount += 1;
    }

    status.textContent = query
      ? visibleCount
        ? `${visibleCount} produk cocok: ${value.trim()}.`
        : `Belum ada produk yang cocok: ${value.trim()}.`
      : "";

    if (clearButton) clearButton.hidden = !value.trim();
    if (scrollToResults && productSection) {
      productSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    applySearch(input.value, true);
  });

  input.addEventListener("input", () => applySearch(input.value));

  clearButton?.addEventListener("click", () => {
    input.value = "";
    applySearch("");
    input.focus();
  });

  document.querySelectorAll("[data-search-term]").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.searchTerm || "";
      applySearch(input.value, true);
    });
  });
})();
