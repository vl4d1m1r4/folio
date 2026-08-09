(function () {
  "use strict";

  function timestamp(value) {
    if (!value) return null;
    var dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    var date = dateOnly
      ? new Date(
          Number(dateOnly[1]),
          Number(dateOnly[2]) - 1,
          Number(dateOnly[3]),
        )
      : new Date(value);
    var time = date.getTime();
    return Number.isNaN(time) ? null : time;
  }

  function initialize(list) {
    var filter = list.dataset.eventFilter || "all";
    var sort = list.dataset.eventSort || "ascending";
    var maxItems = Math.max(0, Number(list.dataset.eventMax) || 0);
    var now = Date.now();
    var grid = list.querySelector("[data-event-grid]");
    var empty = list.querySelector("[data-event-empty]");
    if (!grid) return;

    var items = Array.from(grid.querySelectorAll("[data-event-item]"));
    items.sort(function (a, b) {
      var aTime = timestamp(a.dataset.eventStart);
      var bTime = timestamp(b.dataset.eventStart);
      if (aTime === null && bTime === null) return 0;
      if (aTime === null) return 1;
      if (bTime === null) return -1;
      return sort === "descending" ? bTime - aTime : aTime - bTime;
    });

    var visible = 0;
    items.forEach(function (item) {
      var start = timestamp(item.dataset.eventStart);
      var end = timestamp(item.dataset.eventEnd);
      var effectiveEnd = end === null ? start : end;
      var matches = filter === "all";
      if (filter === "upcoming")
        matches = effectiveEnd !== null && effectiveEnd >= now;
      if (filter === "past")
        matches = effectiveEnd !== null && effectiveEnd < now;
      if (matches && maxItems > 0 && visible >= maxItems) matches = false;
      item.hidden = !matches;
      item.style.display = matches ? "" : "none";
      if (matches) visible += 1;
      grid.appendChild(item);
    });

    if (empty) empty.hidden = visible > 0;
  }

  function initializeAll() {
    document.querySelectorAll("[data-event-list]").forEach(initialize);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeAll);
  } else {
    initializeAll();
  }
})();
