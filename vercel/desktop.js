document.addEventListener("DOMContentLoaded", () => {
  const codeDisplay = document.getElementById("code-display");
  const copyBtn = document.getElementById("copy-btn");
  const progress = document.getElementById("progress");
  const modal = document.getElementById("modal");
  const modalMessage = document.getElementById("modal-message");
  const closeModal = document.querySelector(".close");

  // Theme toggle
  const themeToggle = document.getElementById("theme-toggle");
  const body = document.body;
  const savedTheme = localStorage.getItem("theme") || "dark";
  if (savedTheme === "light") {
    body.classList.add("light");
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  }

  themeToggle.addEventListener("click", () => {
    body.classList.toggle("light");
    const isLight = body.classList.contains("light");
    themeToggle.innerHTML = isLight
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
    localStorage.setItem("theme", isLight ? "light" : "dark");
  });

  // Hamburger menu
  const hamburger = document.querySelector(".hamburger");
  const navLinks = document.querySelector(".nav-links");
  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("active");
  });

  // Modal
  function showModal(message) {
    modalMessage.textContent = message;
    modal.style.display = "block";
  }
  closeModal.addEventListener("click", () => {
    modal.style.display = "none";
  });
  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  // Fetch script
  progress.style.width = "10%";
  fetch("/src/console.js")
    .then((response) => {
      progress.style.width = "50%";
      return response.text();
    })
    .then((data) => {
      codeDisplay.textContent = data;
      Prism.highlightElement(codeDisplay);
      copyBtn.disabled = false;
      progress.style.width = "100%";
      setTimeout(() => (progress.style.width = "0"), 1000);
    })
    .catch((error) => {
      codeDisplay.textContent = "Gagal mengambil kode: " + error.message;
      showModal("Error: Tidak bisa mengambil kode. Cek koneksi internetmu.");
      progress.style.width = "0";
    });

  // Copy code
  copyBtn.addEventListener("click", () => {
    navigator.clipboard
      .writeText(codeDisplay.textContent)
      .then(() => showModal("Kode berhasil disalin!"))
      .catch((err) => showModal("Gagal menyalin kode: " + err));
  });

  // Accordion
  document.querySelectorAll(".accordion-header").forEach((button) => {
    button.addEventListener("click", () => {
      const content = button.nextElementSibling;
      content.classList.toggle("active");
    });
  });
});
