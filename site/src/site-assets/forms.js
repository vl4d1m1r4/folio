// Contact form submission

document.addEventListener("DOMContentLoaded", () => {
  // ── Contact form ──────────────────────────────────────────────────────────
  document.querySelectorAll("[data-contact-form]").forEach((form) => {
    const wrapper = form.closest("[data-contact-block]") ?? form.parentElement;
    const successMsg = wrapper?.querySelector("[data-contact-success]");
    const errorMsg = wrapper?.querySelector("[data-contact-error]");
    const submit = form.querySelector('button[type="submit"]');
    const errorText =
      form.dataset.error || "Something went wrong. Please try again.";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorMsg) {
        errorMsg.textContent = "";
        errorMsg.classList.add("hidden");
      }
      if (submit) submit.disabled = true;
      form.setAttribute("aria-busy", "true");

      const data = Object.fromEntries(new FormData(form).entries());

      try {
        const res = await fetch("/api/v1/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Submission failed");
        }
        form.reset();
        form.style.display = "none";
        if (successMsg) successMsg.classList.remove("hidden");
      } catch (err) {
        if (errorMsg) {
          errorMsg.textContent = err.message || errorText;
          errorMsg.classList.remove("hidden");
        }
      } finally {
        form.removeAttribute("aria-busy");
        if (submit) submit.disabled = false;
      }
    });
  });

  // ── Newsletter subscribe blocks (multiple on a page) ──────────────────────
  document.querySelectorAll(".newsletter-subscribe-form").forEach((form) => {
    const wrapper =
      form.closest("[data-newsletter-block]") ?? form.parentElement;
    const successEl = wrapper.querySelector(".newsletter-subscribe-success");
    const errorEl = wrapper.querySelector(".newsletter-subscribe-error");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) {
        errorEl.textContent = "";
        errorEl.classList.add("hidden");
      }

      const email = form.querySelector('input[name="email"]')?.value?.trim();
      if (!email) return;

      try {
        const res = await fetch("/api/v1/newsletter/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Subscription failed");
        }
        form.style.display = "none";
        if (successEl) successEl.classList.remove("hidden");
      } catch (err) {
        if (errorEl) {
          errorEl.textContent =
            err.message || "Something went wrong. Please try again.";
          errorEl.classList.remove("hidden");
        }
      }
    });
  });

  // ── Unsubscribe page form ─────────────────────────────────────────────────
  const unsubForm = document.getElementById("unsubscribe-form");
  if (unsubForm) {
    const successEl = document.getElementById("unsubscribe-success");
    const errorEl = document.getElementById("unsubscribe-error");
    const successText =
      unsubForm.dataset.success || "You have been unsubscribed successfully.";

    unsubForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) {
        errorEl.textContent = "";
        errorEl.classList.add("hidden");
      }

      const email = unsubForm
        .querySelector('input[name="email"]')
        ?.value?.trim();
      if (!email) return;

      try {
        const res = await fetch("/api/v1/newsletter/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token: "ui" }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to unsubscribe");
        }
        unsubForm.style.display = "none";
        if (successEl) {
          successEl.textContent = successText;
          successEl.classList.remove("hidden");
        }
      } catch (err) {
        if (errorEl) {
          errorEl.textContent =
            err.message || "Something went wrong. Please try again.";
          errorEl.classList.remove("hidden");
        }
      }
    });
  }
});
