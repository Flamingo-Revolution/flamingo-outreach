const EMAIL_COPY_LABELS = {
  en: { subject: 'Copy subject', body: 'Copy email', done: 'Copied', failed: 'Copy failed' },
  tr: { subject: 'Konuyu kopyala', body: 'E-postayı kopyala', done: 'Kopyalandı', failed: 'Kopyalanamadı' },
  el: { subject: 'Αντιγραφή θέματος', body: 'Αντιγραφή μηνύματος', done: 'Αντιγράφηκε', failed: 'Αποτυχία αντιγραφής' },
  ro: { subject: 'Copiază subiectul', body: 'Copiază mesajul', done: 'Copiat', failed: 'Copiere nereușită' },
  bg: { subject: 'Копирай темата', body: 'Копирай писмото', done: 'Копирано', failed: 'Неуспешно копиране' },
  sr: { subject: 'Kopiraj predmet', body: 'Kopiraj poruku', done: 'Kopirano', failed: 'Kopiranje nije uspelo' },
  uk: { subject: 'Копіювати тему', body: 'Копіювати лист', done: 'Скопійовано', failed: 'Не вдалося скопіювати' }
};

function emailCopyLabels(block) {
  return EMAIL_COPY_LABELS[block.closest('[lang]')?.lang] || EMAIL_COPY_LABELS.en;
}

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
    button.textContent = button.dataset.copyFailed || 'Copy failed';
  }
  window.setTimeout(() => { button.textContent = labelOriginal; }, 1600);
}

async function copyEmailBlock(block, button) {
  const labels = emailCopyLabels(block);
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
      button.textContent = labels.done;
    } else {
      await navigator.clipboard.writeText(text);
      button.textContent = labels.done;
    }
  } catch {
    await copyTextOnly(button, text, labels.done, labels.body);
    return;
  }
  window.setTimeout(() => { button.textContent = labels.body; }, 1600);
}

function setupEmailTemplates() {
  document.querySelectorAll('.tabbed-block').forEach((email) => {
    const subject = email.querySelector(':scope > p:first-of-type');
    if (!subject?.querySelector('strong')) return;

    if (email.dataset.copyReady) return;
    email.dataset.copyReady = '1';
    const labels = emailCopyLabels(email);
    subject.classList.add('email-subject');

    const copySubject = document.createElement('button');
    copySubject.type = 'button';
    copySubject.className = 'email-subject__copy';
    copySubject.textContent = labels.subject;
    copySubject.dataset.copyFailed = labels.failed;
    copySubject.setAttribute('aria-label', labels.subject);

    copySubject.addEventListener('click', async () => {
      const subjectCopy = subject.cloneNode(true);
      subjectCopy.querySelectorAll('strong, button').forEach((node) => node.remove());
      const text = subjectCopy.textContent.trim();
      await copyTextOnly(copySubject, text, labels.done, labels.subject);
    });

    const copyFull = document.createElement('button');
    copyFull.type = 'button';
    copyFull.className = 'email-subject__copy email-subject__copy-full';
    copyFull.textContent = labels.body;
    copyFull.dataset.copyFailed = labels.failed;
    copyFull.setAttribute('aria-label', labels.body);
    copyFull.addEventListener('click', () => copyEmailBlock(email, copyFull));

    subject.append(copySubject, copyFull);
  });
}

document.addEventListener('DOMContentLoaded', setupEmailTemplates);
if (typeof document$ !== 'undefined') document$.subscribe(setupEmailTemplates);
