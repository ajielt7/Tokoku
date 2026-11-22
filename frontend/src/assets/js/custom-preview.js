const productForm = document.querySelector("[data-product-form]");
const preview = document.querySelector("[data-custom-preview]");

if (productForm && preview) {
  const fields = [...productForm.querySelectorAll("[data-custom-key]")];
  const rows = [...preview.querySelectorAll("[data-preview-line]")];
  const previewDefaults = { house_number: "01", area_name: "Jl. Soekarno-Hatta" };

  function updateCustomPreview() {
    const values = fields.map((field) => field.value.trim()).slice(0, rows.length);
    rows.forEach((row, index) => {
      const field = fields[index];
      const defaultValue = previewDefaults[field?.dataset.customKey] || "";
      const value = values[index] || defaultValue;
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
