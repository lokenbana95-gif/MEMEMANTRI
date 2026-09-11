(function () {
  const hamburgers = document.querySelectorAll(".hamburger-btn");
  const drawer = document.querySelector(".mobile-drawer");
  const backdrop = document.querySelector(".mobile-backdrop");
  const closeBtn = document.querySelector(".mobile-drawer-close");
  if (!drawer || !backdrop || !hamburgers.length) return;
  function openDrawer() {
    drawer.classList.add("open");
    backdrop.classList.add("open");
    document.body.classList.add("no-scroll");
  }
  function closeDrawer() {
    drawer.classList.remove("open");
    backdrop.classList.remove("open");
    document.body.classList.remove("no-scroll");
  }
  hamburgers.forEach((btn) => btn.addEventListener("click", openDrawer));
  backdrop.addEventListener("click", closeDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  drawer
    .querySelectorAll("a, button")
    .forEach((el) => el.addEventListener("click", closeDrawer));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1100) closeDrawer();
  });
})();
