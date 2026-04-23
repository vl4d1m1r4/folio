// Contact form submission

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const successMsg = document.getElementById("contact-success");
  const errorMsg = document.getElementById("contact-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorMsg) {
      errorMsg.textContent = "";
      errorMsg.classList.add("hidden");
    }

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
        errorMsg.textContent =
          err.message || "Something went wrong. Please try again.";
        errorMsg.classList.remove("hidden");
      }
    }
  });
});
