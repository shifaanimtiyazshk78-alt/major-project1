(function () {
  var select = document.getElementById("ordersCompanyFilter");
  var grid = document.getElementById("ordersGrid");
  if (!select || !grid) return;

  function applyFilter() {
    var v = select.value;
    var cards = grid.querySelectorAll(".order-card");
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var show = v === "all" || c.getAttribute("data-company") === v;
      c.hidden = !show;
    }
  }

  select.addEventListener("change", applyFilter);
  applyFilter();
})();
