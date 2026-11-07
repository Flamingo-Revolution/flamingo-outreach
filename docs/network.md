---
hide:
  - toc
---

# Network

<nav class="status-page-nav" aria-label="Status pages">
  <a href="../">Country map</a>
  <a href="../media-coverage/">Media</a>
  <a href="../institutions/">Institutions</a>
  <a href="../parties/">Parties & groups</a>
  <a href="../actors/">Actors</a>
  <a href="../network/" aria-current="page">Network</a>
  <a href="../remaining/">Remaining</a>
  <a href="../momentum/">Momentum</a>
</nav>

How the civil-society side of the movement connects: actors who took joint **action** together, actors that belong to a parent group, the people **assigned to** or **contributing** data, and institutions an action was addressed to. A missing connection doesn't mean an actor is inactive — just that it isn't recorded here yet.

<div class="coverage-chart-card">
  <p id="network-summary" class="status-page-note" role="status">Loading network…</p>
  <div id="network-graph" role="img" aria-label="Network of actors, actions, institutions and people. The action list below has the same information in text form."></div>
  <div class="network-legend" aria-hidden="true">
    <span class="network-legend-heading">Actor type</span>
    <span class="network-legend-swatch" style="--legend-color:#c62828">Media & press freedom</span>
    <span class="network-legend-swatch" style="--legend-color:#2e7d32">Environmental</span>
    <span class="network-legend-swatch" style="--legend-color:#ad1457">Human & civil rights</span>
    <span class="network-legend-swatch" style="--legend-color:#5e35b1">Diaspora</span>
    <span class="network-legend-swatch" style="--legend-color:#00897b">Grassroots & protest</span>
    <span class="network-legend-swatch" style="--legend-color:#f9a825">Business association</span>
    <span class="network-legend-swatch" style="--legend-color:#8d6e63">Research & academic</span>
    <span class="network-legend-swatch" style="--legend-color:#78909c">Civil society / other</span>
    <span class="network-legend-heading">Other node kinds</span>
    <span class="network-legend-swatch" style="--legend-color:#af6010">Action</span>
    <span class="network-legend-swatch" style="--legend-color:#455a64">Institution</span>
    <span class="network-legend-swatch" style="--legend-color:#1976d2">Person</span>
  </div>
  <p id="network-selection" class="status-page-note" role="status"></p>
</div>

<details class="status-disclosure status-page-filters"><summary class="status-disclosure-summary"><span>Search & filters</span></summary>
<div class="coverage-sort-control">
  <label for="network-search">Find a node</label>
  <input id="network-search" type="search" placeholder="Actor, action, institution or person" autocomplete="off">
  <label for="network-category-filter">Actor category</label>
  <select id="network-category-filter"><option value="">All categories</option></select>

  <fieldset class="network-filter-group">
    <legend>Show node types</legend>
    <label><input id="network-kind-actor" type="checkbox" checked> Actors</label>
    <label><input id="network-kind-action" type="checkbox" checked> Actions</label>
    <label><input id="network-kind-institution" type="checkbox" checked> Institutions</label>
    <label><input id="network-kind-person" type="checkbox" checked> People</label>
  </fieldset>

  <fieldset class="network-filter-group">
    <legend>Show relationships</legend>
    <label><input id="network-edge-action" type="checkbox" checked> Joint actions</label>
    <label><input id="network-edge-partof" type="checkbox" checked> Part of parent group</label>
    <label><input id="network-edge-assigned" type="checkbox" checked> Assigned to</label>
    <label><input id="network-edge-credit" type="checkbox" checked> Data contributor</label>
  </fieldset>

  <fieldset class="network-filter-group">
    <legend>Layout</legend>
    <label><input type="radio" name="network-layout" value="balanced" checked> Balanced (force)</label>
    <label><input type="radio" name="network-layout" value="spread"> Spread out (force)</label>
    <label><input type="radio" name="network-layout" value="tight"> Tight clusters (force)</label>
    <label><input type="radio" name="network-layout" value="concentric"> Concentric by connections</label>
    <label><input type="radio" name="network-layout" value="circle"> Circle</label>
  </fieldset>

  <label><input id="network-show-isolated" type="checkbox"> Show nodes with no recorded connections</label>
  <button id="network-fit" type="button">Fit graph</button>

  <button id="network-reset" type="button" data-status-reset>Reset filters</button>
</div>
</details>

Circle size tracks number of connections. Actors whose only connection is one action shared by more than 10 others are folded into a dashed "+N more actors" node — search a name to pull it back out. Select a node for details; select an action to open it below.

## Actions

<p class="status-page-note">Sorted by number of actors involved. Same data as the graph, in text form.</p>
<div id="network-actions" class="network-actions" aria-live="polite">Loading actions…</div>

## Download the data

[Download the actor list](assets/data/actors.csv) or the [action log](assets/data/actions.csv), or [update the shared workbook](https://docs.google.com/spreadsheets/d/19qp5A7qB5DwoKEF6WlYKy_GSWNOxTgMX/edit?usp=sharing).
