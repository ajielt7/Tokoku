(() => {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const menuButton = header.querySelector(".menu-toggle");
  const navigation = header.querySelector(".main-nav");
  const mobileMenu = window.matchMedia("(max-width: 700px)");

  if (menuButton && navigation) {
    const setMenuOpen = (open) => {
      header.classList.toggle("menu-open", open);
      navigation.hidden = mobileMenu.matches && !open;
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
    };

    const syncMenuToViewport = () => {
      if (mobileMenu.matches) {
        setMenuOpen(false);
      } else {
        header.classList.remove("menu-open");
        navigation.hidden = false;
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Buka menu");
      }
    };

    menuButton.addEventListener("click", () => {
      setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true");
    });
    navigation.addEventListener("click", (event) => {
      if (event.target.closest("a") && mobileMenu.matches) setMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mobileMenu.matches) setMenuOpen(false);
    });
    mobileMenu.addEventListener("change", syncMenuToViewport);
    syncMenuToViewport();
  }

  const scrollSentinel = document.createElement("span");
  scrollSentinel.setAttribute("aria-hidden", "true");
  scrollSentinel.className = "header-scroll-sentinel";
  scrollSentinel.style.cssText = "display:block;height:1px;margin-bottom:-1px;pointer-events:none";
  header.before(scrollSentinel);

  const observer = new IntersectionObserver(([entry]) => {
    header.classList.toggle("is-scrolled", !entry.isIntersecting);
  }, { threshold: 0 });
  observer.observe(scrollSentinel);
})();
