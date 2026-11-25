const productForm = document.querySelector("[data-product-form]");
const preview = document.querySelector("[data-custom-preview]");

if (productForm && preview) {
  const fields = [...productForm.querySelectorAll("[data-custom-key]")];
  const rows = [...preview.querySelectorAll("[data-preview-line]")];

  function updateCustomPreview() {
    const values = fields.map((field) => field.value.trim()).slice(0, rows.length);
    rows.forEach((row, index) => {
      const value = values[index] || "";
      row.textContent = value;
      const length = value.length;
      row.setAttribute("font-size", String(value ? Math.max(300, Math.min(660, 1600 / Math.max(1, length * 0.66))) : 660));
    });
    const filledValues = values.filter(Boolean);
    preview.setAttribute("aria-label", filledValues.length ? `Pratinjau desain dengan ${filledValues.join(", ")}` : "Pratinjau kosong, isi nomor rumah");
  }

  fields.forEach((field) => field.addEventListener("input", updateCustomPreview));
  updateCustomPreview();
}
