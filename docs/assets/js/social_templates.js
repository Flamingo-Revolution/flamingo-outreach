function setupSocialTemplates() {
  document.querySelectorAll('.social-template').forEach((template) => {
    if (template.dataset.copyReady) return;
    const paragraphs = template.querySelectorAll('p');
    if (!paragraphs.length) return;
    template.dataset.copyReady = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'md-button';
    button.textContent = 'Copy message';
    button.dataset.copyFailed = 'Copy failed';
    button.addEventListener('click', () => {
      const text = Array.from(paragraphs)
        .map((paragraph) => {
          const copy = paragraph.cloneNode(true);
          copy.querySelectorAll('a').forEach((link) => {
            link.replaceWith(`${link.textContent} (${link.href})`);
          });
          return copy.textContent.trim();
        })
        .join('\n\n');
      copyTextOnly(button, text, 'Copied', 'Copy message');
    });
    template.append(button);
  });
}

document.addEventListener('DOMContentLoaded', setupSocialTemplates);
if (typeof document$ !== 'undefined') document$.subscribe(setupSocialTemplates);
