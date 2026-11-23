(() => {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const menuButton = header.querySelector(".menu-toggle");
  const menuIcon = menuButton?.querySelector(".menu-icon");
  const navigation = header.querySelector(".main-nav");
  const mobileMenu = window.matchMedia("(max-width: 960px)");

  if (menuButton && navigation) {
    const setMenuOpen = (open) => {
      header.classList.toggle("menu-open", open);
      navigation.hidden = mobileMenu.matches && !open;
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
      menuIcon?.classList.toggle("fa-bars", !open);
      menuIcon?.classList.toggle("fa-xmark", open);
    };

    const syncMenuToViewport = () => {
      if (mobileMenu.matches) {
        setMenuOpen(false);
      } else {
        header.classList.remove("menu-open");
        navigation.hidden = false;
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Buka menu");
        menuIcon?.classList.add("fa-bars");
        menuIcon?.classList.remove("fa-xmark");
      }
    };

    navigation.addEventListener("click", (event) => {
      if (event.target.closest("a") && mobileMenu.matches) setMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mobileMenu.matches) setMenuOpen(false);
    });
    mobileMenu.addEventListener("change", syncMenuToViewport);
    syncMenuToViewport();
  }

  const updateHeader = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
})();

