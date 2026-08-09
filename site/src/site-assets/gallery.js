/* Image lightbox for article images and Gallery blocks. */
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    const groups = [];

    const articleImages = [];
    const cover = document.getElementById("article-cover");
    if (cover) articleImages.push(cover);
    document.querySelectorAll(".prose img").forEach(function (image) {
      articleImages.push(image);
    });
    if (articleImages.length) {
      groups.push(
        articleImages.map(function (image) {
          return { trigger: image, image: image, caption: "" };
        }),
      );
    }

    document.querySelectorAll("[data-gallery]").forEach(function (gallery) {
      const items = [];
      gallery.querySelectorAll("[data-gallery-item]").forEach(function (trigger) {
        const image = trigger.querySelector("img");
        if (!image) return;
        items.push({
          trigger: trigger,
          image: image,
          caption: trigger.dataset.galleryCaption || "",
        });
      });
      if (items.length) groups.push(items);
    });

    if (!groups.length) return;

    const overlay = document.createElement("div");
    overlay.id = "gallery-overlay";
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-hidden", "true");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Image gallery");
    overlay.innerHTML =
      '<div id="gallery-backdrop"></div>' +
      '<button id="gallery-close" aria-label="Close gallery">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      "</button>" +
      '<button id="gallery-prev" aria-label="Previous image">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
      "</button>" +
      '<button id="gallery-next" aria-label="Next image">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>' +
      "</button>" +
      '<div id="gallery-content"><img id="gallery-img" src="" alt="" /><div id="gallery-caption"></div></div>' +
      '<div id="gallery-counter"></div>';
    document.body.appendChild(overlay);

    const galleryImage = document.getElementById("gallery-img");
    const caption = document.getElementById("gallery-caption");
    const counter = document.getElementById("gallery-counter");
    const closeButton = document.getElementById("gallery-close");
    const previousButton = document.getElementById("gallery-prev");
    const nextButton = document.getElementById("gallery-next");
    const backdrop = document.getElementById("gallery-backdrop");
    let activeItems = [];
    let current = 0;
    let returnFocus = null;
    let previousOverflow = "";
    let touchStartX = 0;
    let touchStartY = 0;

    function show(index) {
      current = ((index % activeItems.length) + activeItems.length) % activeItems.length;
      const item = activeItems[current];
      galleryImage.src = item.image.currentSrc || item.image.src;
      galleryImage.alt = item.image.alt || "";
      caption.textContent = item.caption;
      caption.hidden = !item.caption;
      counter.textContent =
        activeItems.length > 1
          ? current + 1 + " / " + activeItems.length
          : "";
      previousButton.hidden = activeItems.length < 2;
      nextButton.hidden = activeItems.length < 2;
    }

    function open(items, index, trigger) {
      activeItems = items;
      returnFocus = trigger;
      show(index);
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      overlay.classList.add("active");
      overlay.setAttribute("aria-hidden", "false");
      closeButton.focus();
    }

    function close() {
      if (!overlay.classList.contains("active")) return;
      overlay.classList.remove("active");
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = previousOverflow;
      if (returnFocus && typeof returnFocus.focus === "function") {
        returnFocus.focus();
      }
    }

    groups.forEach(function (items) {
      items.forEach(function (item, index) {
        const trigger = item.trigger;
        if (trigger.tagName === "IMG") {
          trigger.tabIndex = 0;
          trigger.setAttribute("role", "button");
          trigger.setAttribute(
            "aria-label",
            trigger.alt ? "Open image: " + trigger.alt : "Open image",
          );
        }
        trigger.addEventListener("click", function () {
          open(items, index, trigger);
        });
        if (trigger.tagName === "IMG") {
          trigger.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              open(items, index, trigger);
            }
          });
        }
      });
    });

    closeButton.addEventListener("click", close);
    backdrop.addEventListener("click", close);
    previousButton.addEventListener("click", function () {
      show(current - 1);
    });
    nextButton.addEventListener("click", function () {
      show(current + 1);
    });

    document.addEventListener("keydown", function (event) {
      if (!overlay.classList.contains("active")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowLeft" && activeItems.length > 1) {
        event.preventDefault();
        show(current - 1);
      } else if (event.key === "ArrowRight" && activeItems.length > 1) {
        event.preventDefault();
        show(current + 1);
      }
    });

    overlay.addEventListener(
      "touchstart",
      function (event) {
        touchStartX = event.changedTouches[0].clientX;
        touchStartY = event.changedTouches[0].clientY;
      },
      { passive: true },
    );
    overlay.addEventListener(
      "touchend",
      function (event) {
        if (activeItems.length < 2) return;
        const deltaX = event.changedTouches[0].clientX - touchStartX;
        const deltaY = event.changedTouches[0].clientY - touchStartY;
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
          show(deltaX < 0 ? current + 1 : current - 1);
        }
      },
      { passive: true },
    );
  });
})();
