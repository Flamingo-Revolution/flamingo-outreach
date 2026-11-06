---
hide:
  - toc
---

# Media coverage

See where the protests are being reported. Select a country on the map to see which outlets have posts and which do not.

<div class="coverage-chart-card coverage-chart-card--map">
  <div class="status-map-stats" id="coverage-map-stats" aria-label="Media coverage statistics" aria-live="polite">
    <article><strong id="coverage-stat-countries">—</strong><span>countries tracked</span></article>
    <article><strong id="coverage-stat-outlets">—</strong><span>media outlets</span></article>
    <article class="status-map-stat--positive"><strong id="coverage-stat-published">—</strong><span>outlets with coverage</span></article>
    <article class="status-map-stat--attention"><strong id="coverage-stat-uncovered">—</strong><span>outlets to check</span></article>
  </div>
  <div id="coverage-map" aria-label="Map of international media coverage by country"></div>
  <div class="coverage-map-legend" id="coverage-map-legend"></div>
</div>


<div class="coverage-sort-control">
  <label for="mentions-country-filter">Country</label>
  <select id="mentions-country-filter">
    <option value="">All countries</option>
  </select>
  <label for="mentions-search">Find an outlet</label>
  <input id="mentions-search" type="search" placeholder="Outlet name" autocomplete="off">
</div>

<p class="coverage-priority-summary" id="mentions-summary" role="status">Loading published coverage…</p>

<div class="coverage-priority-list" id="media-reports-list" aria-live="polite"></div>

## Download the data

This page includes only rows with at least one recorded article or post in the list above. A link shows that coverage was found; it does not imply that every claim in the publication has been independently verified.

[Download the CSV](assets/data/media_coverage.csv). This is a snapshot, so coverage may change between checks.
