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


if __name__ == '__main__':
    unittest.main()
