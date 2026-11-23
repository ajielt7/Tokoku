(() => {
  const section = document.querySelector("[data-intl-quote]");
  const link = section?.querySelector("[data-quote-link]");
  if (!section || !link) return;

  link.addEventListener("click", () => {
    const details = Array.from(section.querySelectorAll("[data-custom-key]"))
      .map((input) => `${input.dataset.customLabel || input.dataset.customKey}: ${input.value.trim()}`)
      .filter((value) => !value.endsWith(": "));
    const quantity = section.querySelector('[name="quantity"]')?.value;
    if (quantity) details.push(`${section.dataset.quantityLabel || "Quantity"}: ${quantity}`);
    const template = section.dataset.quoteTemplate || "Hello Toqoku, I am interested in {product}.";
    const message = template
      .replace("{product}", section.dataset.productName || "your product")
      .replace("{details}", details.join("; "));
    const detailsLine = details.length
      ? ` ${section.dataset.detailsTemplate?.replace("{details}", details.join("; ")) || details.join("; ")}`
      : "";
    const priceLine = section.dataset.displayPrice
      ? ` ${section.dataset.priceTemplate?.replace("{price}", section.dataset.displayPrice) || section.dataset.displayPrice}`
      : "";
    const url = new URL(`https://wa.me/${section.dataset.whatsapp || "6283172527880"}`);
    url.searchParams.set("text", `${message}${detailsLine}${priceLine}`);
    link.href = url.href;
  });
})();

