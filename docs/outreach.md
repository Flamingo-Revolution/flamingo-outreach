---
hide:
  - toc
  - navigation
---

<div id="outreach-overview" class="outreach-overview outreach-overview--map-only">
  <div class="outreach-country-search" role="search">
    <div class="outreach-country-search-box">
      <span class="outreach-country-search-icon" aria-hidden="true">⌕</span>
      <input id="outreach-country-search" type="text" placeholder="Go to a country…" autocomplete="off" role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-controls="outreach-country-search-results" aria-autocomplete="list" aria-label="Search and open a country">
    </div>
    <ul id="outreach-country-search-results" class="outreach-country-search-results" role="listbox" hidden></ul>
  </div>

  <aside id="outreach-left-panel" class="outreach-side-panel outreach-side-panel--left" aria-label="Map status controls">
    <header class="outreach-panel-header">
      <button id="outreach-panel-close" class="outreach-panel-close" type="button" aria-label="Close map controls">×</button>
      <h1>Status map</h1>
    </header>
    <div class="outreach-panel-tabs" role="tablist" aria-label="Map controls">
      <button id="outreach-tab-view" type="button" role="tab" aria-controls="outreach-pane-view" aria-selected="true" tabindex="0"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></svg><span>Map view</span></button>
      <button id="outreach-tab-stats" type="button" role="tab" aria-controls="outreach-pane-stats" aria-selected="false" tabindex="-1"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 20V12M12 20V4M19 20v-9"/></svg><span>Totals</span></button>
      <button id="outreach-tab-help" type="button" role="tab" aria-controls="outreach-pane-help" aria-selected="false" tabindex="-1"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01"/></svg><span>Guide</span></button>
    </div>
    <section id="outreach-pane-view" class="outreach-panel-section outreach-panel-pane" role="tabpanel" aria-labelledby="outreach-tab-view" tabindex="0">
      <p class="outreach-pane-caption">Choose what the markers show.</p>
      <label for="outreach-layer">Category</label>
      <select id="outreach-layer"><option value="all">All categories</option><option value="media">Media coverage</option><option value="institutions">Institution responses</option><option value="mps">MP responses</option><option value="parties">Party responses</option></select>
      <label for="outreach-display">Marker display</label>
      <select id="outreach-display" aria-describedby="outreach-marker-description"><option value="percentage">Percentage</option><option value="numbers">Numbers (done / total)</option><option value="done-todo" selected>Done + todo</option></select>
      <button id="outreach-reset" type="button">Back to Europe</button>
    </section>
    <section id="outreach-pane-stats" class="outreach-panel-section outreach-panel-pane" role="tabpanel" aria-labelledby="outreach-tab-stats" tabindex="0" hidden>
      <p class="outreach-pane-caption">Totals for the selected category, across all countries and groups.</p>
      <div class="outreach-completion"><div><span>Source links recorded</span><strong id="outreach-completion-label">—</strong></div><progress id="outreach-completion" max="100" value="0" aria-label="Share of entries with source links"></progress></div>
      <div class="outreach-stats-list" aria-label="Outreach statistics">
        <div class="outreach-stat-row"><span>Countries & groups</span><strong id="outreach-stat-countries">—</strong></div>
        <div class="outreach-stat-row"><span>Total entries</span><strong id="outreach-stat-total">—</strong></div>
        <div class="outreach-stat-row outreach-stat-row--positive"><span>With a source link</span><strong id="outreach-stat-recorded">—</strong></div>
        <div class="outreach-stat-row outreach-stat-row--attention"><span>Without a source link</span><strong id="outreach-stat-missing">—</strong></div>
      </div>
    </section>
    <section id="outreach-pane-help" class="outreach-panel-section outreach-panel-pane" role="tabpanel" aria-labelledby="outreach-tab-help" tabindex="0" hidden>
      <p class="outreach-pane-caption">Understand the markers and find your next step.</p>
      <ol class="outreach-mobile-guide">
        <li>Search for a country, or tap a marker to open its entries.</li>
        <li>Use Map controls to change the category or marker display.</li>
        <li>In country details, choose a category, then search, filter or sort the entries. Tap an entry to see its links.</li>
      </ol>
      <p id="outreach-marker-description" class="outreach-note" aria-live="polite">Done + todo: 6⁺⁴ means 6 entries with source links and 4 still without. Larger circles mean more listed entries. Select a marker to see the records.</p>
      <p class="outreach-note">Done means an entry has a link to coverage or a response. Todo means it has no source link in this tracker; coverage or a response may exist elsewhere. Colors always show the percentage done.</p>
      <div class="outreach-legend" aria-label="Capital marker color by share of linked coverage or responses">
        <span style="--country-color:#c45b64">0–25% linked</span><span style="--country-color:#ca8c36">>25–50% linked</span><span style="--country-color:#73a787">>50–75% linked</span><span style="--country-color:#277f73">>75–100% linked</span><span style="--country-color:#a3abb4">No entries</span>
      </div>
    </section>
    <p class="outreach-note">Workbook checked 7 November 2026. Source links are recorded by contributors; each entry may cover an earlier date.</p>
    <p id="outreach-summary" class="outreach-note" role="status">Loading country data…</p>
  </aside>
  <button id="outreach-panel-backdrop" class="outreach-panel-backdrop" type="button" aria-label="Close map controls" tabindex="-1" hidden></button>
  <button id="outreach-left-toggle" class="outreach-sidebar-handle outreach-sidebar-handle--left" type="button" aria-controls="outreach-left-panel" aria-expanded="true" aria-label="Toggle status controls"><span aria-hidden="true">☷</span><span class="outreach-toggle-label">Map controls</span></button>

  <div class="outreach-map-shell">
    <div id="outreach-map" aria-label="Country outreach map. Select a marker to open country information."></div>
    <div class="outreach-map-hint"><span class="outreach-desktop-hint">Select a marker for country details</span><span class="outreach-touch-hint">Tap a marker · Pinch to zoom</span></div>
  </div>

</div>
