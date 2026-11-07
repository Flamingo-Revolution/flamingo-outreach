# Outreach — action-first civic rights guide

MkDocs Material website for nonpartisan human-rights outreach related to Albania.

**Main tabs:** Home · Countries · Letters · Background.

The public-facing entry points prioritize practical outreach. Context, incident analysis, evidence and bibliography are grouped under Background.

## Edit the CSVs

All CSVs are at `docs/assets/`:
- `sources.csv` — publications and original URLs
- `incidents.csv` — reported incidents and affected groups
- `incident_evidence.csv` — evidence items linked by source and incident ID

The site provides examples and direct links in Sources → CSV files and examples.
Downloadable fictional templates are in `docs/assets/examples/`.

## Media coverage data pipeline

The public Excel workbook is the source of truth. `scripts/update-media-coverage.py`
downloads it, validates its sheets, and writes the CSV files the site loads.
`Media Coverage` is required and uses the simplified eight-column layout:
`Country`, `Media Outlet`, `Website`, `Instagram`, `Article URLs`, `Tags`,
`Email`, and `Date`. The `Sources`, `Incidents`, and `Evidence` (or
`Incident Evidence`) sheets populate the downloadable examples under
`docs/assets/examples/`; they never overwrite the live evidence datasets.
Optional `Protest Timeline` (or `Timeline`) sheets are also imported. First rows
must contain the exact CSV column names used by their destination files.

`Institutions & Actors` uses the combined fourteen-column layout: `Country`,
`City`, `EU Member`, `Organization`, `Category`, `Office in Albania`, `Issues`,
`Website`, `Email`, `Response Date`, `Response Type`, `Response Link`, and
`Contact Route`, followed by `Contribution`.
Embassy records belong in this sheet and appear alongside the other
organizations on the Institutions and actors page. Multiple response values
may be separated with semicolons; corresponding dates, types, and links should
use the same order.

`Political Parties` uses: `Country`, `Party`, `Website`, `Priority`, `Issues`,
`Status`, `Response Link`, and `Instagram Evidence`.

Run it manually with:

```bash
python scripts/update-media-coverage.py
```

The `Update outreach data` GitHub Actions workflow runs every other calendar day
at 00:17 UTC (odd-numbered dates, resetting each month)
and commits the generated CSV when it changes. It can also be run manually from
the Actions tab.

## Run

GitHub Actions runs the **Check outreach site** workflow on pull requests,
pushes to `main`, and manual dispatch. It runs the workbook importer tests,
JavaScript tests, and a strict MkDocs build. **Publish docs** deploys the site
to GitHub Pages on pushes to `main` and after successful scheduled or manual
data updates. Set the repository's Pages source to **GitHub Actions** to enable
deployment.

```bash
pip install -r requirements.txt
mkdocs serve
mkdocs build
```

The ADCN evidence brief is attributed to its original author. External images remain subject to publishers' permissions.

## Licensing

This is a community-maintained, dual-licensed project:

- Original code is licensed under
  [GNU AGPL-3.0-only](LICENSE-CODE.md), including its network source-sharing
  requirement.
- Original community datasets are available under
  [CC BY-NC 4.0](LICENSE-DATA.md), with attribution and non-commercial use
  requirements.

See [the licensing overview](LICENSE.md) for the exact scope and third-party
material exceptions. Contributions, corrections, and responsible community
reuse are welcome.

## Contributor attribution

Add a **Contributors** column (the singular **Contributor** is also accepted) to every workbook sheet. It can appear anywhere;
keep the other headings in their existing order. Use a consistent public name
or handle and separate multiple contributors with semicolons (`Alex; Sam`).
This credits the people entering or maintaining data, independently of the
institutional `Contribution` field.

The importer accepts sheets with or without this new column, publishes it as
`contributors` in each managed CSV, and generates
`docs/assets/data/contributors.json` from all workbook sheets. Status →
Contributors ranks people by attributed rows, with a worksheet filter and a
Cytoscape network connecting people to sheets. A shared row gives each named
person one credit; duplicate names in a cell count once. Case and whitespace
variations are merged. Blank attribution stays blank; existing contributions
are never assigned automatically. Repeated edits to a row do not add credits.

Run the normal data update after adding names. The scheduled workflow also
publishes the totals. Editing the public Google workbook requires access to
that workbook; changes to this repository alone do not edit the live sheet.

## Country map and reports

Status → Country map combines media, institutions, MPs, and parties into one
overview. Selecting a country or category opens its information in a modal over
the map, with category tabs, source links, contact routes, and filters. The modal
is centered on desktop and becomes a bottom sheet on mobile. Close it with the
close button, Escape, or a backdrop click. International groups remain available
in the country list. Standalone `country/?country=Germany#institutions` links
remain available when opened in a new tab.

Map colors measure the share of listed entries with linked coverage or responses,
not support or whether someone has been contacted. Empty categories are shown as
having no recorded entries. Existing category directories are under Directories.

The optional **MPs** (or **Members of Parliament**) workbook sheet uses:
`Country`, `Name`, `Party`, `Role`, `Website`, `Email`, `Response Date`,
`Response Type`, `Response Link`, and `Notes`, plus the optional `Contributors`
column. It is published as `docs/assets/data/mps.csv`. That CSV starts empty;
individual MPs are never inferred from political-party records.

The importer preserves extra named verification and follow-up columns after the required columns in institutions and parties sheets. It skips country-only media placeholder rows and converts spreadsheet dates for display.
