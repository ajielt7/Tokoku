const galleryImage = document.querySelector(".detail-visual .detail-photo");
const galleryButtons = [...document.querySelectorAll("[data-gallery-thumb]")];

if (galleryImage && galleryButtons.length) {
  galleryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const source = button.dataset.gallerySrc;
      const alt = button.dataset.galleryAlt;
      if (!source || !alt) return;

      galleryImage.src = source;
      galleryImage.alt = alt;
      galleryButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
    });
  });
}
