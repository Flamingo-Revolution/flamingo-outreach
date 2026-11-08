(function () {
  function apply(value) {
    document.querySelectorAll('.topic-panel').forEach(function (panel) {
      panel.hidden = panel.dataset.topic !== value;
    });
  }
  function init() {
    var select = document.querySelector('.topic-select');
    if (!select) return;
    apply(select.value);
    select.addEventListener('change', function () {
      apply(select.value);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
