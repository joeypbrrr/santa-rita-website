(function () {
  var dock = document.querySelector(".dock");
  var locking = false;
  if (dock) {
    document.addEventListener("focusin", function (event) {
      if (locking) return;
      var target = event.target;
      if (!(target instanceof Element) || dock.contains(target)) return;
      if (getComputedStyle(dock).display === "none") return;
      var rect = target.getBoundingClientRect();
      if (rect.bottom <= dock.getBoundingClientRect().top - 12) return;
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      locking = true;
      target.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      window.setTimeout(function () { locking = false; }, reduce ? 0 : 400);
    });
  }
  var dialog = document.getElementById("viewer");
  var viewerImg = document.getElementById("viewer-img");
  var viewerTitle = document.getElementById("viewer-title");
  var closeBtn = document.getElementById("viewer-close");
  var last = null;
  if (!dialog) return;
  document.querySelectorAll("a.enlarge").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      var cap = link.getAttribute("data-cap") || link.textContent.replace(/\s+/g, " ").trim();
      viewerTitle.textContent = cap;
      viewerImg.alt = "";
      viewerImg.style.setProperty("--nw", (link.getAttribute("data-w") || "700") + "px");
      viewerImg.src = link.getAttribute("data-full") || link.getAttribute("href");
      last = link;
      dialog.showModal();
      closeBtn.focus();
    });
  });
  closeBtn.addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener("close", function () {
    viewerImg.removeAttribute("src");
    if (last) last.focus();
  });
})();
