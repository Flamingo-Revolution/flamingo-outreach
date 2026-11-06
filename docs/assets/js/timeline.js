const timelineScriptSrc = document.currentScript.src;
const timelineAssetsBase = new URL('../data/', timelineScriptSrc);

function setupTimeline() {
  const root = document.getElementById('timeline-results');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';

  const search = document.getElementById('timeline-search');
  const filter = document.getElementById('timeline-filter');
  const count = document.getElementById('timeline-count');

  fetch(new URL('timeline.csv', timelineAssetsBase))
    .then(response => {
      if (!response.ok) throw Error(response.status);
      return response.text();
    })
    .then(text => {
      const data = csvRows(text).filter(item => item.track !== 'political');
      [...new Set(data.map(item => item.category))].sort().forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        filter.append(option);
      });

      function render() {
        const term = search.value.toLowerCase();
        const items = data.filter(item =>
          (!filter.value || item.category === filter.value) &&
          (!term || Object.values(item).join(' ').toLowerCase().includes(term))
        );

        count.textContent = `${items.length} of ${data.length} milestones`;
        root.replaceChildren();

        items.forEach(item => {
          const card = document.createElement('article');
          card.className = 'timeline-card';

          const marker = document.createElement('span');
          marker.className = 'timeline-marker';
          marker.setAttribute('aria-hidden', 'true');

          const date = document.createElement('time');
          date.dateTime = item.date_iso;
          date.textContent = item.date_label;

          const tag = document.createElement('span');
          tag.className = 'timeline-tag';
          tag.textContent = item.category;

          const heading = document.createElement('h2');
          heading.textContent = item.title;

          const place = document.createElement('strong');
          place.className = 'timeline-place';
          place.textContent = item.location;

          const summary = document.createElement('p');
          summary.textContent = item.summary;

          const source = document.createElement('a');
          source.href = item.source_url.startsWith('http')
            ? item.source_url
            : new URL(item.source_url, new URL('../../', timelineScriptSrc)).href;
          source.target = '_blank';
          source.rel = 'noopener noreferrer';
          source.textContent = `${item.source_name} ↗`;

          const status = document.createElement('small');
          status.textContent = item.source_status;

          card.append(marker, date, tag, heading, place, summary, source, status);
          root.append(card);
        });
      }

      search.addEventListener('input', render);
      filter.addEventListener('change', render);
      render();
    })
    .catch(() => {
      root.textContent = 'Unable to load the timeline CSV. Use mkdocs serve.';
    });
}

document.addEventListener('DOMContentLoaded', setupTimeline);
if (typeof document$ !== 'undefined') document$.subscribe(setupTimeline);
