(() => {
  const form = document.querySelector("[data-product-search]");
  const input = document.querySelector("[data-product-search-input]");
  const clearButton = document.querySelector("[data-product-search-clear]");
  const status = document.querySelector("[data-product-search-status]");
  const productSection = document.querySelector("#produk");
  const cards = Array.from(document.querySelectorAll("#produk .product-card"));
  const messages = form.dataset;
  const isEnglish = document.documentElement.lang === "en";

  if (!form || !input || !status || !cards.length) return;

  // Public order codes are either five digits (current) or legacy RUMA-… codes.
  const isOrderCode = (value) => /^(?:\d{5}|RUMA-[A-Z0-9]{16})$/i.test(value.trim());

  const normalize = (value) => value
    .toLocaleLowerCase(isEnglish ? "en" : "id-ID")
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
        ? (messages.resultTemplate || `${visibleCount} produk cocok: ${value.trim()}.`)
          .replace("{count}", String(visibleCount)).replace("{query}", value.trim())
        : (messages.emptyTemplate || `Belum ada produk yang cocok: ${value.trim()}.`)
          .replace("{query}", value.trim())
      : "";

    if (clearButton) clearButton.hidden = !value.trim();
    if (scrollToResults && productSection) {
      productSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (isOrderCode(value) && !isEnglish) {
      const trackingUrl = new URL("./lacak-pesanan/", window.location.href);
      trackingUrl.searchParams.set("order", value.toUpperCase());
      window.location.assign(trackingUrl.href);
      return;
    }
    if (isOrderCode(value) && isEnglish) {
      status.textContent = messages.orderCodeMessage || "";
      return;
    }
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

