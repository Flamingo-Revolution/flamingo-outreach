---
hide:
  - toc
---

# Momentum

<nav class="status-page-nav" aria-label="Status pages">
  <a href="../">Country map</a>
  <a href="../media-coverage/">Media</a>
  <a href="../institutions/">Institutions</a>
  <a href="../parties/">Parties & groups</a>
  <a href="../actors/">Actors</a>
  <a href="../network/">Network</a>
  <a href="../remaining/">Remaining</a>
  <a href="../momentum/" aria-current="page">Momentum</a>
</nav>

Compare recorded protest events with political and institutional actions over time. Counts show activity in this dataset, not the size of a protest or proof that one event caused another.

<div class="momentum-stats" aria-label="Events in the selected view">
  <article><strong id="momentum-stat-protest">—</strong><span>protest events</span></article>
  <article><strong id="momentum-stat-political">—</strong><span>political &amp; institutional actions</span></article>
  <article><strong id="momentum-stat-weeks">—</strong><span>weeks with recorded activity</span></article>
</div>

<details class="status-disclosure status-page-filters"><summary class="status-disclosure-summary"><span>Search &amp; filters</span></summary>
<div class="coverage-sort-control momentum-filters">
  <label for="momentum-search">Search events</label><input id="momentum-search" type="search" placeholder="Event, location or source">
  <label for="momentum-from">From</label><input id="momentum-from" type="date">
  <label for="momentum-to">To</label><input id="momentum-to" type="date">
  <button type="button" data-status-reset>Reset filters</button>
</div>
</details>
<p id="momentum-summary" class="status-page-note" role="status">Loading timeline totals…</p>

<div class="momentum-chart-card">
<div class="momentum-chart-head"><span>Protest events</span><span>Political &amp; institutional action</span></div>
<div id="momentum-chart">Loading momentum chart…</div>
<div class="momentum-legend">
  <span class="momentum-legend-item"><span class="momentum-swatch" style="background:#1976d2">●</span>Protest events</span>
  <span class="momentum-legend-item"><span class="momentum-swatch" style="background:#2e7d32">✓</span>Favorable to protesters' demands</span>
  <span class="momentum-legend-item"><span class="momentum-swatch" style="background:#f57c00">~</span>Mixed or unclear</span>
  <span class="momentum-legend-item"><span class="momentum-swatch" style="background:#c62828">✕</span>Against protesters' demands</span>
</div>
</div>

Both sides share one scale. Weeks without recorded activity are omitted; this does not establish that nothing happened. “Before the protests” groups actions recorded before the first protest week in this dataset. Select a bar for its sources, or browse the events below.

## Browse events

<p class="status-page-note">Newest first. Open an event for its summary, source and evidence status.</p>
<div id="momentum-events" class="momentum-events" aria-label="Recorded events">Loading events…</div>

<dialog id="momentum-popup-overlay" class="country-popup momentum-dialog" aria-labelledby="momentum-popup-title">
  <section class="country-popup-panel">
    <header class="country-popup-header">
      <h2 id="momentum-popup-title"></h2>
      <button id="momentum-popup-close" type="button" class="country-popup-close" aria-label="Close event details">×</button>
    </header>
    <div id="momentum-popup-body" class="country-popup-body momentum-events"></div>
  </section>
</dialog>

## About the sources

**Stance colors are editorial classifications**, not statements made by the cited sources. Check the source before drawing conclusions.

Both sides are drawn from [one combined timeline CSV](assets/data/timeline.csv), split by its `track` column (`protest` vs `political`). The [full timeline](timeline.md) also includes rights-monitoring entries (`rights`), which are not counted as protest events or political actions in this chart; the political rows are hand-curated from sources already cited on this site's action and status pages and are not an independently audited record. A legal filing, referendum step or statement listed here does not establish wrongdoing or predict an outcome, and the `stance` column reflects this page's own reading of each entry's effect on the protesters' demands, not the source's own framing.
