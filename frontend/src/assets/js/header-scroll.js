(() => {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const menuButton = header.querySelector(".menu-toggle");
  const navigation = header.querySelector(".main-nav");
  const mobileMenu = window.matchMedia("(max-width: 700px)");

  if (menuButton && navigation) {
    const menuIcon = menuButton.querySelector("svg path");
    const menuPath = "M4 6h16M4 12h16M4 18h16";
    const closePath = "M6 6l12 12M18 6 6 18";
    const setMenuOpen = (open) => {
      header.classList.toggle("menu-open", open);
      navigation.hidden = mobileMenu.matches && !open;
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
      if (menuIcon) menuIcon.setAttribute("d", open ? closePath : menuPath);
    };

    const syncMenuToViewport = () => {
      if (mobileMenu.matches) {
        setMenuOpen(false);
      } else {
        header.classList.remove("menu-open");
        navigation.hidden = false;
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Buka menu");
        if (menuIcon) menuIcon.setAttribute("d", menuPath);
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
