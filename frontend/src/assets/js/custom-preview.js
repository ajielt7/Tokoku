const productForm = document.querySelector("[data-product-form]");
const preview = document.querySelector("[data-custom-preview]");

if (productForm && preview) {
  const fields = [...productForm.querySelectorAll("[data-custom-key]")];
  const rows = [...preview.querySelectorAll("[data-preview-line]")];

  function updateCustomPreview() {
    const values = fields.map((field) => field.value.trim()).slice(0, rows.length);
    const firstField = fields[0];
    const isNumber = firstField?.getAttribute("inputmode") === "numeric";
    rows.forEach((row, index) => {
      const value = values[index] || (index === 0 && isNumber ? "123" : "");
      row.textContent = value;
      const length = value.length;
      row.setAttribute("font-size", String(value ? Math.max(24, Math.min(index === 0 ? 70 : 25, 420 / Math.max(1, length * 0.62))) : index === 0 ? 70 : 25));
    });
    const filledValues = values.filter(Boolean);
    preview.setAttribute("aria-label", filledValues.length ? `Pratinjau desain dengan ${filledValues.join(", ")}` : "Pratinjau desain contoh");
  }

  fields.forEach((field) => field.addEventListener("input", updateCustomPreview));
  updateCustomPreview();
}
