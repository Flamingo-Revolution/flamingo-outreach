function emailNodeToText(node, out) {
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(node.textContent);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const tag = node.tagName.toLowerCase();

  if (tag === 'hr') {
    out.push('\n\n---\n\n');
    return;
  }
  if (tag === 'a') {
    const href = node.getAttribute('href') || '';
    const text = node.textContent.trim();
    out.push(!href || text === href ? text : `${text} (${href})`);
    return;
  }
  if (tag === 'strong' || tag === 'b') {
    out.push('**');
    node.childNodes.forEach(c => emailNodeToText(c, out));
    out.push('**');
    return;
  }
  if (tag === 'em' || tag === 'i') {
    out.push('_');
    node.childNodes.forEach(c => emailNodeToText(c, out));
    out.push('_');
    return;
  }
  if (tag === 'li') {
    out.push('- ');
    node.childNodes.forEach(c => emailNodeToText(c, out));
    out.push('\n');
    return;
  }
  if (tag === 'ul' || tag === 'ol' || tag === 'p' || tag === 'div') {
    node.childNodes.forEach(c => emailNodeToText(c, out));
    out.push('\n\n');
    return;
  }
  node.childNodes.forEach(c => emailNodeToText(c, out));
}

function emailBlockToPlainText(clone) {
  const out = [];
  clone.childNodes.forEach(c => emailNodeToText(c, out));
  return out.join('').replace(/\n{3,}/g, '\n\n').trim();
}

async function copyTextOnly(button, text, labelDone, labelOriginal) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = labelDone;
  } catch {
    button.textContent = 'Copy failed';
  }
  window.setTimeout(() => { button.textContent = labelOriginal; }, 1600);
}

async function copyEmailBlock(block, button) {
  const clone = block.cloneNode(true);
  clone.querySelectorAll('.email-subject, .admonition.warning').forEach(el => el.remove());
  const html = clone.innerHTML;
  const text = emailBlockToPlainText(clone);

  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      });
      await navigator.clipboard.write([item]);
      button.textContent = 'Copied';
    } else {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    }
  } catch {
    await copyTextOnly(button, text, 'Copied', 'Copy email');
    return;
  }
  window.setTimeout(() => { button.textContent = 'Copy email'; }, 1600);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tabbed-block').forEach((email) => {
    const subject = email.querySelector(':scope > p:first-of-type');
    if (!subject?.querySelector('strong')) return;

    subject.classList.add('email-subject');

    const copySubject = document.createElement('button');
    copySubject.type = 'button';
    copySubject.className = 'email-subject__copy';
    copySubject.textContent = 'Copy subject';
    copySubject.setAttribute('aria-label', 'Copy email subject');

    copySubject.addEventListener('click', async () => {
      const subjectCopy = subject.cloneNode(true);
      subjectCopy.querySelectorAll('strong, button').forEach((node) => node.remove());
      const text = subjectCopy.textContent.trim();
      await copyTextOnly(copySubject, text, 'Copied', 'Copy subject');
    });

    const copyFull = document.createElement('button');
    copyFull.type = 'button';
    copyFull.className = 'email-subject__copy email-subject__copy-full';
    copyFull.textContent = 'Copy email';
    copyFull.setAttribute('aria-label', 'Copy full email, including links');
    copyFull.addEventListener('click', () => copyEmailBlock(email, copyFull));

    subject.append(copySubject, copyFull);
  });
});
