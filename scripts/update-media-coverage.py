#!/usr/bin/env python3
"""Download the outreach workbook and publish every recognized sheet as CSV."""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import os
import re
import sys
import urllib.request
import zipfile
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree as ET


DEFAULT_WORKBOOK_URL = "https://docs.google.com/spreadsheets/d/19qp5A7qB5DwoKEF6WlYKy_GSWNOxTgMX/edit"
ASSETS_DIR = Path("docs/assets/data")

MEDIA_HEADERS = [
    "Country",
    "Media Outlet",
    "Website",
    "Instagram",
    "Article URLs",
    "Tags",
    "Email",
    "Date",
    "Evidence (numbers and source)",
    "Assigned To",
]

OUTPUT_HEADERS = [
    "country_code",
    "country",
    "outlet",
    "outlet_url",
    "instagram_url",
    "article_urls",
    "tags",
    "contact_email",
    "dates",
    "evidence",
    "assigned_to",
    "contributors",
]

COUNTRY_CODES = {
    "Argentina": "AR",
    "Chile": "CL",
    "Albania": "AL",
    "Andorra": "AD",
    "Armenia": "AM",
    "Australia": "AU",
    "Austria": "AT",
    "Azerbaijan": "AZ",
    "Belarus": "BY",
    "Belgium": "BE",
    "Bosnia and Herzegovina": "BA",
    "Brazil": "BR",
    "Bulgaria": "BG",
    "Canada": "CA",
    "China": "CN",
    "Croatia": "HR",
    "Cyprus": "CY",
    "Czechia": "CZ",
    "Denmark": "DK",
    "Estonia": "EE",
    "European Union": "EU",
    "Finland": "FI",
    "France": "FR",
    "Georgia": "GE",
    "Germany": "DE",
    "Greece": "GR",
    "Hungary": "HU",
    "Iceland": "IS",
    "India": "IN",
    "International": "INT",
    "Ireland": "IE",
    "Italy": "IT",
    "Japan": "JP",
    "Kosovo": "XK",
    "Latvia": "LV",
    "Liechtenstein": "LI",
    "Lithuania": "LT",
    "Luxembourg": "LU",
    "Malta": "MT",
    "Moldova": "MD",
    "Monaco": "MC",
    "Montenegro": "ME",
    "Netherlands": "NL",
    "New Zealand": "NZ",
    "North Macedonia": "MK",
    "Norway": "NO",
    "Poland": "PL",
    "Portugal": "PT",
    "Romania": "RO",
    "Russia": "RU",
    "Saudi Arabia": "SA",
    "San Marino": "SM",
    "Serbia": "RS",
    "Slovakia": "SK",
    "Slovenia": "SI",
    "South Africa": "ZA",
    "Spain": "ES",
    "Social media": "SOC",
    "Sweden": "SE",
    "Switzerland": "CH",
    "Turkey": "TR",
    "UAE": "AE",
    "Ukraine": "UA",
    "United Kingdom": "GB",
    "United States": "US",
    "Vatican City": "VA",
}

XML_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PACKAGE_REL_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}"

CSV_SHEETS = {
    "Institutions": "institutions.csv",
    "Actors": "actors.csv",
    "Actions": "actions.csv",
    "Embassies by Country": "embassies.csv",
    "Political Parties": "political_parties.csv",
    "MPs": "mps.csv",
    "Members of Parliament": "mps.csv",
    "Issues Gallery": "issues_gallery.csv",
    "Sources": "../examples/sources-example.csv",
    "Incidents": "../examples/incidents-example.csv",
    "Evidence": "../examples/incident-evidence-example.csv",
    "Incident Evidence": "../examples/incident-evidence-example.csv",
    "Protest Timeline": "protest_timeline.csv",
    "Timeline": "protest_timeline.csv",
}

CSV_HEADERS = {
    "institutions.csv": ["institution_id", "organization", "category", "country", "city", "website", "email", "issues", "requested_action", "response_date", "response_type", "response_link", "contact_route", "contribution", "evidence_url", "assigned_to"],
    "actors.csv": ["actor_id", "organization", "category", "part_of", "city", "country", "website", "instagram_url", "evidence_url", "email", "issues", "requested_action", "response_date", "response_type", "response_link", "contact_route", "contribution", "assigned_to"],
    "actions.csv": ["action_id", "action", "actor_ids", "evidence_urls", "response_to", "notes", "institution_ids"],
    "embassies.csv": ["country", "representation", "category", "official_website", "instagram_url", "verification"],
    "political_parties.csv": ["country", "party", "website", "priority", "issues", "status", "response_link", "instagram_evidence"],
    "mps.csv": ["country", "name", "party", "role", "website", "email", "response_date", "response_type", "response_link", "notes"],
    "issues_gallery.csv": ["date", "category", "issue", "location", "source_url", "status", "tags"],
    "sources-example.csv": [
        "source_id", "published_date", "event_date", "publisher", "title", "url",
        "category", "format", "topic", "verification", "origin", "notes",
    ],
    "incidents-example.csv": [
        "incident_id", "event_date", "location", "affected_group", "alleged_actor",
        "incident_type", "summary", "evidence_status", "source_ids", "adcn_reference",
        "reported_count", "limitations",
    ],
    "incident-evidence-example.csv": [
        "evidence_id", "incident_id", "source_id", "event_date", "media_type",
        "evidence_title", "description", "publisher_url", "image_url", "adcn_reference",
        "observation", "verification_status", "rights_and_safety_notes",
    ],
    "protest_timeline.csv": [
        "date_iso", "date_label", "title", "location", "category", "summary",
        "source_name", "source_url", "source_status",
    ],
}


def extract_contributors(rows: list[list[str]]) -> tuple[list[list[str]], list[str]]:
    """Remove the optional attribution column while retaining legacy schema validation."""
    if not rows:
        return rows, []
    indexes = [i for i, value in enumerate(rows[0])
               if value.lstrip("\ufeff").strip().casefold() in {"contributor", "contributors"}]
    if len(indexes) > 1:
        raise ValueError("Only one Contributors column is allowed per worksheet.")
    if not indexes:
        return rows, [""] * (len(rows) - 1)
    index = indexes[0]
    credits = [row[index].strip() if index < len(row) else "" for row in rows[1:]]
    return [[value for i, value in enumerate(row) if i != index] for row in rows], credits


def column_index(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference)
    if not letters:
        raise ValueError(f"Invalid spreadsheet cell reference: {reference}")
    result = 0
    for character in letters.group():
        result = result * 26 + ord(character) - ord("A") + 1
    return result - 1


def read_workbook(workbook: bytes) -> dict[str, list[list[str]]]:
    """Read all XLSX worksheets using only the Python standard library."""
    try:
        archive = zipfile.ZipFile(io.BytesIO(workbook))
        workbook_root = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships_root = ET.fromstring(
            archive.read("xl/_rels/workbook.xml.rels")
        )
    except (KeyError, zipfile.BadZipFile, ET.ParseError) as error:
        raise ValueError(f"Downloaded file is not a supported XLSX workbook: {error}") from error

    try:
        shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        shared_strings = [
            "".join(node.text or "" for node in item.iter(f"{XML_NS}t"))
            for item in shared_root.findall(f"{XML_NS}si")
        ]
    except KeyError:
        shared_strings = []

    targets = {
        relationship.get("Id"): relationship.get("Target", "")
        for relationship in relationships_root.findall(f"{PACKAGE_REL_NS}Relationship")
    }
    sheets: dict[str, list[list[str]]] = {}
    for sheet in workbook_root.iter(f"{XML_NS}sheet"):
        name = sheet.get("name", "").strip()
        target = targets.get(sheet.get(f"{REL_NS}id"), "")
        if not target:
            raise ValueError(f'Could not locate worksheet "{name}" in the workbook.')
        sheet_path = target.lstrip("/")
        if not sheet_path.startswith("xl/"):
            sheet_path = f"xl/{sheet_path}"
        sheet_root = ET.fromstring(archive.read(sheet_path))
        sheets[name] = read_sheet(sheet_root, shared_strings)
    return sheets


def read_sheet(sheet_root: ET.Element, shared_strings: list[str]) -> list[list[str]]:
    rows: list[list[str]] = []
    for row_node in sheet_root.iter(f"{XML_NS}row"):
        values: dict[int, str] = {}
        for cell in row_node.findall(f"{XML_NS}c"):
            value_node = cell.find(f"{XML_NS}v")
            value = "" if value_node is None else (value_node.text or "")
            if cell.get("t") == "s" and value:
                value = shared_strings[int(value)]
            elif cell.get("t") == "inlineStr":
                value = "".join(
                    node.text or "" for node in cell.iter(f"{XML_NS}t")
                )
            values[column_index(cell.get("r", ""))] = value.strip()
        if values and any(values.values()):
            width = max(values) + 1
            rows.append([values.get(index, "") for index in range(width)])
    return rows


def normalize_media_coverage(rows: list[list[str]]) -> list[dict[str, str]]:
    if not rows:
        raise ValueError("The workbook contains no rows.")

    rows, credits = extract_contributors(rows)
    workbook_headers = [header.lstrip("\ufeff") for header in rows[0]]
    if workbook_headers != MEDIA_HEADERS:
        raise ValueError(
            "Unexpected workbook columns. Expected: "
            + ", ".join(MEDIA_HEADERS)
            + ". Received: "
            + ", ".join(value or "<blank>" for value in rows[0])
        )

    output: list[dict[str, str]] = []
    for spreadsheet_row, values in enumerate(rows[1:], start=2):
        padded = values + [""] * (len(workbook_headers) - len(values))
        source = dict(zip(workbook_headers, padded, strict=False))
        country = source["Country"]
        outlet = source["Media Outlet"] or infer_outlet_name(source["Website"])
        if not any(value.strip() for key, value in source.items() if key != "Country"):
            continue

        if not country or not outlet:
            raise ValueError(f"Row {spreadsheet_row}: Country and Media Outlet are required.")
        if country not in COUNTRY_CODES:
            raise ValueError(f'Row {spreadsheet_row}: unknown country "{country}".')

        output.append(
            {
                "country_code": COUNTRY_CODES[country],
                "country": country,
                "outlet": outlet,
                "outlet_url": source["Website"],
                "instagram_url": source["Instagram"],
                "article_urls": source["Article URLs"],
                "tags": source["Tags"],
                "contact_email": source["Email"],
                "dates": normalize_dates(source["Date"]),
                "evidence": source["Evidence (numbers and source)"],
                "assigned_to": source["Assigned To"],
                "contributors": credits[spreadsheet_row - 2],
            }
        )
    return output


def infer_outlet_name(website: str) -> str:
    """Derive a readable name when a row supplies a website but no outlet."""
    parsed = urlparse(website)
    domain = (parsed.hostname or "").removeprefix("www.").split(".")[0]
    if not domain:
        return ""
    domain_name = domain.upper() if len(domain) <= 4 else domain.replace("-", " ").title()
    path_name = parsed.path.strip("/").split("/", 1)[0].replace("-", " ").title()
    return " ".join(value for value in (domain_name, path_name) if value)


def normalize_dates(value: str) -> str:
    """Convert Excel serial dates while preserving semicolon-separated values."""
    if not value.strip():
        return ""
    normalized: list[str] = []
    for raw_date in value.split(";"):
        date = raw_date.strip()
        if not date:
            normalized.append("")
            continue
        try:
            serial = float(date)
        except ValueError:
            normalized.append(date)
            continue
        converted = dt.date(1899, 12, 30) + dt.timedelta(days=int(serial))
        normalized.append(converted.isoformat())
    return "; ".join(normalized).rstrip("; ")


def publish_csv(name: str, rows: list[list[str]], output: Path) -> int:
    """Publish a sheet whose headings are already the site's CSV headings."""
    if not rows:
        raise ValueError(f'The "{name}" sheet contains no rows.')
    rows, credits = extract_contributors(rows)
    source_headers = [value.lstrip("\ufeff") for value in rows[0]]
    while source_headers and not source_headers[-1]:
        source_headers.pop()
    expected = CSV_HEADERS[output.name]
    workbook_headers = {
        "Institutions": ["Institution ID", "Institution", "Level", "Country", "City", "Website", "Email", "Issues", "Requested Action", "Response Date", "Response Type", "Response Link", "Contact Route", "Contribution", "Evidence URL", "Assigned To"],
        # The trailing "Assigned To" column's heading is not validated by name: the
        # workbook has briefly shipped it blank, so it's accepted by position instead.
        "Actors": ["Contributor ID", "Organization / Group", "Category", "PartOf (ID)", "HQ City", "HQ Country", "Website", "Instagram", "Evidence URL", "Email", "Issues", "Requested Action", "Response Date", "Response Type", "Response Link", "Contact Route", "Contribution"],
        "Actions": ["Action ID", "Action", "Contributor IDs", "Evidence URLs", "Response To", "Notes", "Institution IDs"],
        "Embassies by Country": ["Country", "Representation", "Category", "Official Website", "Instagram URL", "Verification"],
        "Political Parties": ["Country", "Party", "Website", "Priority", "Issues", "Status", "Response Link", "Instagram Evidence"],
        "MPs": ["Country", "Name", "Party", "Role", "Website", "Email", "Response Date", "Response Type", "Response Link", "Notes"],
        "Members of Parliament": ["Country", "Name", "Party", "Role", "Website", "Email", "Response Date", "Response Type", "Response Link", "Notes"],
        "Issues Gallery": ["Date", "Category", "Issue", "Location", "Source URL", "Status", "Tags"],
    }
    required_headers = workbook_headers.get(name, expected)
    if source_headers[:len(required_headers)] != required_headers:
        raise ValueError(
            f'The "{name}" sheet headings do not match {output.name}. Expected: '
            + ", ".join(required_headers)
        )

    extra_headers = [re.sub(r"[^a-z0-9]+", "_", value.casefold()).strip("_")
                     for value in source_headers[len(required_headers):]]
    fields = [*expected, *extra_headers]
    if any(not field for field in fields) or len(set([*fields, "contributors"])) != len(fields) + 1:
        raise ValueError(f'The "{name}" sheet has blank or duplicate headings.')
    output.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow([*fields, "contributors"])
        for values, credit in zip(rows[1:], credits):
            padded = values + [""] * (len(fields) - len(values))
            if any(padded[len(fields):]):
                raise ValueError(f'The "{name}" sheet has data beyond its headings.')
            output_values = padded[:len(fields)]
            if not any(value.strip() for value in output_values):
                continue
            for index, field in enumerate(fields):
                if field.endswith("_date") or field in {"date", "checked_on"}:
                    output_values[index] = normalize_dates(output_values[index])
                if field in {"eu_member", "office_in_albania"} and output_values[index] in {"0.0", "1.0"}:
                    output_values[index] = output_values[index][0]
            writer.writerow([*output_values, credit])
            count += 1
    return count


def backfill_actor_activity(sheets: dict[str, list[list[str]]]) -> None:
    """An actor named on a joint action is already evidenced by that action.

    Give actors with no Evidence URL of their own the first evidence link
    from an action they are named in, so being part of a recorded action is
    enough on its own — contributors do not need to also cite a separate
    link for the actor just to show it is active.
    """
    actions_rows = sheets.get("Actions")
    actors_rows = sheets.get("Actors")
    if not actions_rows or not actors_rows:
        return

    actions_header = actions_rows[0]
    try:
        actors_col = actions_header.index("Contributor IDs")
        evidence_col = actions_header.index("Evidence URLs")
    except ValueError:
        return
    activity_evidence: dict[str, str] = {}
    for row in actions_rows[1:]:
        actor_ids = row[actors_col] if actors_col < len(row) else ""
        evidence_urls = row[evidence_col] if evidence_col < len(row) else ""
        first_url = next((url.strip() for url in evidence_urls.split(";") if url.strip()), "")
        if not first_url:
            continue
        for actor_id in (value.strip() for value in actor_ids.split(";")):
            if actor_id and actor_id not in activity_evidence:
                activity_evidence[actor_id] = first_url

    actors_header = actors_rows[0]
    try:
        id_col = actors_header.index("Contributor ID")
        actor_evidence_col = actors_header.index("Evidence URL")
    except ValueError:
        return
    for row in actors_rows[1:]:
        while len(row) <= actor_evidence_col:
            row.append("")
        actor_id = row[id_col] if id_col < len(row) else ""
        if not row[actor_evidence_col].strip() and actor_id in activity_evidence:
            row[actor_evidence_col] = activity_evidence[actor_id]


def publish_workbook(workbook: bytes) -> list[tuple[str, int]]:
    sheets = read_workbook(workbook)
    backfill_actor_activity(sheets)
    published: list[tuple[str, int]] = []

    media_rows = sheets.get("Media Coverage")
    if media_rows is None:
        raise ValueError('Required worksheet "Media Coverage" is missing.')
    records = normalize_media_coverage(media_rows)
    media_output = ASSETS_DIR / "media_coverage.csv"
    media_output.parent.mkdir(parents=True, exist_ok=True)
    with media_output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_HEADERS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(records)
    published.append((str(media_output), len(records)))

    claimed_outputs: set[str] = set()
    for sheet_name, filename in CSV_SHEETS.items():
        if sheet_name not in sheets or filename in claimed_outputs:
            continue
        output = ASSETS_DIR / filename
        count = publish_csv(sheet_name, sheets[sheet_name], output)
        published.append((str(output), count))
        claimed_outputs.add(filename)
    return published


def download() -> bytes:
    load_dotenv(Path(".env"))
    workbook_url = os.environ.get("OUTREACH_WORKBOOK_URL", DEFAULT_WORKBOOK_URL)
    match = re.search(r"/spreadsheets/d/([^/]+)", workbook_url)
    if not match:
        raise ValueError("OUTREACH_WORKBOOK_URL is not a valid Google Sheets URL.")
    export_url = (
        f"https://docs.google.com/spreadsheets/d/{match.group(1)}/export?format=xlsx"
    )
    request = urllib.request.Request(
        export_url, headers={"User-Agent": "flamingo-outreach-data-updater"}
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def load_dotenv(path: Path) -> None:
    """Load simple KEY=VALUE pairs without overriding the process environment."""
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source-file",
        type=Path,
        help="Use a local XLSX file instead of downloading the public workbook.",
    )
    args = parser.parse_args()

    workbook = args.source_file.read_bytes() if args.source_file else download()
    published = publish_workbook(workbook)
    for output, count in published:
        print(f"Saved {count} rows to {output}.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
