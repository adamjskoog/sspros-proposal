"""Recheck the historical fictional run without generating or altering model answers."""
from datetime import datetime, timezone
from pathlib import Path
import json

from grading import GRADER_VERSION, grade_case, failed_checks, summarize
from public_export import assert_public_export, file_hash

HERE = Path(__file__).parent
SOURCE = HERE / "results/20261101T200215Z-claude-opus-5-5-medium.json"
DATASET = HERE / "dataset.jsonl"


def regrade():
    from run_eval import update_site
    original = json.loads(SOURCE.read_text(encoding="utf-8"))
    dataset = {case['id']: case for line in DATASET.read_text(encoding='utf-8').splitlines() if line.strip() for case in [json.loads(line)]}
    rows = []
    for row in original['rows']:
        case = dataset[row['id']]
        if row['inquiry'] != case['inquiry']:
            raise ValueError('Saved inquiry no longer matches the fictional fixture.')
        checks = grade_case(case['expected'], row['handoff'], case.get('forbid')) if row['handoff'] else failed_checks(case['expected'])
        rows.append({**row, 'expected': case['expected'], 'checks': checks})
    meta = {**original['meta'], 'data_classification': 'authored-fictional', 'regraded_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
            'grader_version': GRADER_VERSION, 'hash_format': 'sha256-utf8-lf', 'grader_sha256': file_hash(HERE/'grading.py'), 'dataset_sha256': file_hash(DATASET),
            'source_run_sha256': file_hash(SOURCE), 'generation_provenance': 'Historical run; original prompt/code hashes were not recorded. Model outputs are unchanged.'}
    assert_public_export(rows, meta)
    summary = summarize(rows)
    output = {'meta': meta, 'summary': summary, 'rows': rows}
    (HERE/'results/regraded.json').write_text(json.dumps(output, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
    update_site(summary, rows, meta)
    print(json.dumps({'automatic_checks':summary['all_checks_passed'], 'flagged_cases':[r['id'] for r in rows if any(v is False for v in r['checks'].values())]}, indent=2))


if __name__ == '__main__':
    regrade()
