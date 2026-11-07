/* Shared disclosure and reset behavior for Status directory controls. */
function setupStatusFilters() {
  document.querySelectorAll('.status-page-filters').forEach(details => {
    if (details.dataset.ready) return;
    details.dataset.ready = '1';
    const controls = [...details.querySelectorAll('input, select')];
    const reset = details.querySelector('[data-status-reset]');
    const state = document.createElement('span');
    state.className = 'status-disclosure-state';
    details.querySelector('summary').append(state);
    const defaultValue = control => control.tagName === 'SELECT'
      ? ([...control.options].find(option => option.defaultSelected) || control.options[0])?.value || ''
      : control.defaultValue;
    const update = () => {
      const count = controls.filter(control => control.value !== defaultValue(control)).length;
      state.textContent = count ? `${count} active` : '';
      if (reset) reset.disabled = !count;
    };
    details.addEventListener('input', update);
    details.addEventListener('change', update);
    reset?.addEventListener('click', () => {
      controls.forEach(control => { control.value = defaultValue(control); });
      controls.forEach(control => control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })));
      update();
    });
    update();
  });
}
document.addEventListener('DOMContentLoaded', setupStatusFilters);
if (typeof document$ !== 'undefined') document$.subscribe(setupStatusFilters);
