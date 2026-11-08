function setupSocialTemplates() {
  document.querySelectorAll('.social-template').forEach((template) => {
    if (template.dataset.copyReady) return;
    const message = template.querySelector('p');
    if (!message) return;
    template.dataset.copyReady = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'md-button';
    button.textContent = 'Copy message';
    button.dataset.copyFailed = 'Copy failed';
    button.addEventListener('click', () => {
      const copy = message.cloneNode(true);
      copy.querySelectorAll('a').forEach((link) => {
        link.replaceWith(`${link.textContent} (${link.href})`);
      });
      copyTextOnly(button, copy.textContent.trim(), 'Copied', 'Copy message');
    });
    template.append(button);
  });
}

document.addEventListener('DOMContentLoaded', setupSocialTemplates);
if (typeof document$ !== 'undefined') document$.subscribe(setupSocialTemplates);
