"""Regression checks for attribution and the optional MPs workbook sheet."""
import csv
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('updater', ROOT / 'scripts/update-media-coverage.py')
updater = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(updater)


class WorkbookContributorsTests(unittest.TestCase):
    def test_legacy_media_and_attribution_in_any_column(self):
        row = ['Albania', 'Outlet', '', '', '', '', '', '', '']
        legacy = [updater.MEDIA_HEADERS, row]
        self.assertEqual(updater.normalize_media_coverage(legacy)[0]['contributors'], '')
        for index in (0, 4, len(row)):
            headers, values = updater.MEDIA_HEADERS.copy(), row.copy()
            headers.insert(index, 'Contributors')
            values.insert(index, 'Alex; Sam')
            self.assertEqual(updater.normalize_media_coverage([headers, values])[0]['contributors'], 'Alex; Sam')

    def test_singular_contributor_heading_is_supported(self):
        rows = [['Country', 'Contributor'], ['Albania', 'Alex']]
        stripped, credits = updater.extract_contributors(rows)
        self.assertEqual(stripped, [['Country'], ['Albania']])
        self.assertEqual(credits, ['Alex'])
        with self.assertRaises(ValueError):
            updater.extract_contributors([['Contributor', 'Contributors']])

    def test_media_combines_both_online_contributor_columns(self):
        headers = updater.MEDIA_HEADERS.copy()
        headers.insert(9, 'Contributor')
        headers.append('Contributor')
        row = ['Albania', 'Outlet', 'https://example.test', '', '', '', '', '', '', 'Alex; Sam', 'Assigned actor', 'sam; Jo']
        sparse = ['Germany', 'Other outlet']
        records = updater.normalize_media_coverage([headers, row, sparse])
        self.assertEqual(records[0]['contributors'], 'Alex; Sam; Jo')
        self.assertEqual(records[0]['assigned_to'], 'Assigned actor')
        self.assertEqual(records[0]['outlet_url'], 'https://example.test')
        self.assertEqual(records[1]['contributors'], '')

    def test_media_ignores_empty_trailing_columns_without_losing_data(self):
        headers = [*updater.MEDIA_HEADERS, 'Contributor', '']
        row = ['Albania', 'Outlet', '', '', '', '', '', '', '', '', 'Alex', '']
        self.assertEqual(updater.normalize_media_coverage([headers, row])[0]['contributors'], 'Alex')
        row[-1] = 'Unexpected data'
        with self.assertRaisesRegex(ValueError, 'unnamed trailing column'):
            updater.normalize_media_coverage([headers, row])

    def test_shared_rows_and_duplicate_names_are_counted_once(self):
        sheets = {
            'Media Coverage': [['value', 'Contributors'], ['entry', 'Alex; Sam; alex']],
            'Institutions & Actors': [['value', 'Contributors'], ['entry', '  SAM  '], ['', 'name only'], ['entry', '']],
        }
        result = updater.contributor_summary(sheets)
        self.assertEqual([(p['name'], p['total']) for p in result['contributors']], [('Sam', 2), ('Alex', 1)])
        self.assertEqual(result['unattributed_rows'], 1)
        self.assertEqual(result['contributors'][0]['sheets'], {'Media Coverage': 1, 'Institutions & Actors': 1})

    def test_duplicate_attribution_columns_are_rejected(self):
        with self.assertRaises(ValueError):
            updater.extract_contributors([['Contributors', 'contributors']])

    def test_mp_sheet_import_and_generated_totals(self):
        media = [updater.MEDIA_HEADERS, ['Albania', 'Outlet', '', '', '', '', '', '', '']]
        headers = ['Country', 'Name', 'Party', 'Role', 'Website', 'Email', 'Response Date', 'Response Type', 'Response Link', 'Notes', 'Contributors']
        values = ['Germany', 'Example MP', 'Example party', 'MP', '', '', '2026-10-15', 'Statement', 'https://example.test/statement', '', 'Alex; Sam']
        for sheet_name in ('MPs', 'Members of Parliament'):
            with self.subTest(sheet=sheet_name), tempfile.TemporaryDirectory() as folder:
                output = Path(folder) / 'data'
                with patch.object(updater, 'ASSETS_DIR', output), patch.object(updater, 'read_workbook', return_value={'Media Coverage': media, sheet_name: [headers, values]}):
                    updater.publish_workbook(b'fixture')
                with (output / 'mps.csv').open(newline='') as handle:
                    records = list(csv.DictReader(handle))
                self.assertEqual(records[0]['name'], 'Example MP')
                self.assertEqual(records[0]['contributors'], 'Alex; Sam')
                totals = json.loads((output / 'contributors.json').read_text())
                self.assertEqual(totals['contributors'][0]['total'], 1)
                self.assertEqual(totals['contributors'][0]['sheets'], {sheet_name: 1})

    def test_politicians_sheet_import_normalizes_evidence_dates(self):
        headers = [
            'Figure ID', 'Name', 'Entity Category', 'Political Role / Type', 'Party / Group', 'Country',
            'EU Parliament', 'First Recorded Date', 'Evidence Count', 'Engagement Classification',
            'Verification Status', 'Website', 'Instagram', 'Email', 'Assigned To', 'Notes', 'Evidence IDs',
            'Evidence Dates', 'Evidence Classifications', 'Evidence Descriptions', 'Evidence URLs',
        ]
        values = [
            'PE-004', 'Example MEP', 'Individual politician', 'MEP', 'Greens/EFA', 'Netherlands', 'Yes',
            '46190.0', '2.0', 'Direct quotation', '', '', '', '', '', '', 'EV-0004; EV-0043', '46190.0; 46202.0',
            'Direct quotation; Explicit support', 'Support for protesters; Raised demands in Brussels',
            'https://example.test/one; https://example.test/two',
        ]
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'politicians.csv'
            updater.publish_csv('Politicians', [headers, values], output)
            with output.open(newline='') as handle:
                record = next(csv.DictReader(handle))
        self.assertEqual(record['name'], 'Example MEP')
        self.assertEqual(record['first_recorded_date'], updater.normalize_dates('46190.0'))
        self.assertEqual(record['evidence_dates'], updater.normalize_dates('46190.0; 46202.0'))
        self.assertEqual(record['evidence_urls'], 'https://example.test/one; https://example.test/two')

    def test_country_only_media_placeholders_are_skipped(self):
        rows = [updater.MEDIA_HEADERS, ['Sweden'], ['Argentina', 'Outlet', '', '', '', '', '', '', '']]
        records = updater.normalize_media_coverage(rows)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]['country_code'], 'AR')

    def test_verification_columns_are_preserved_and_dates_normalized(self):
        rows = [
            ['Country', 'Party', 'Website', 'Priority', 'Issues', 'Status', 'Response Link', 'Instagram Evidence', 'Verification Notes', 'Checked On'],
            ['Chile', 'Group', '', '', '', '', '', '', 'Needs source review', '46310.0'],
        ]
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'political_parties.csv'
            updater.publish_csv('Political Parties', rows, output)
            with output.open(newline='') as handle:
                record = next(csv.DictReader(handle))
            self.assertEqual(record['verification_notes'], 'Needs source review')
            self.assertEqual(record['checked_on'], updater.normalize_dates('46310.0'))



if __name__ == '__main__':
    unittest.main()
