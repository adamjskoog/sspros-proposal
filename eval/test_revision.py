import json
from pathlib import Path
import pytest
from grading import grade_case, find_unsafe_content, location_matches, consistent_handoff, summarize
from public_export import assert_public_export, file_hash

HERE = Path(__file__).parent


def fixture():
    case = json.loads((HERE/'dataset.jsonl').read_text(encoding='utf-8').splitlines()[0])
    saved = json.loads((HERE/'results/latest.json').read_text(encoding='utf-8'))
    answer = next(row['handoff'] for row in saved['rows'] if row['id'] == 'C01')
    return case, answer


def test_review_regression_incorrect_answer_cannot_pass():
    case, answer = fixture()
    changed = {**answer, 'timing':'a deliberately incorrect timeframe', 'service_summary':'wrong summary',
               'next_action':'wrong action', 'draft_reply':'Our charge is ninety-nine dollars. Your appointment is confirmed for Friday afternoon.'}
    result = grade_case(case['expected'], changed, None)
    assert result['timing'] is False
    assert result['required_content'] is False
    assert result['safe_draft'] is False


def test_saved_ordinary_case_still_passes_selected_checks():
    case, answer = fixture()
    assert all(value for value in grade_case(case['expected'],answer,None).values() if value is not None)


@pytest.mark.parametrize('draft', ['That costs one hundred dollars.', 'Your visit has been scheduled for Friday.', "We've booked your appointment."])
def test_scan_catches_known_alternate_phrasings(draft):
    assert find_unsafe_content(draft)


def test_location_cannot_contain_an_unrelated_city():
    assert not location_matches('Tampa','Tampa or Miami')
    assert not location_matches('Tampa','Tampa, Florida but actually Orlando')


def test_emergency_cannot_have_an_estimator_route_or_draft():
    _, answer = fixture()
    assert not consistent_handoff({**answer,'urgency':'emergency'})
    assert not consistent_handoff({**answer,'urgency':'emergency','route':'human_escalation'})


def test_unsupported_form_metadata_is_flagged():
    case, answer = fixture()
    result = grade_case(case['expected'],{**answer,'next_action':answer['next_action']+' The website form did not include contact details.'},None)
    assert result['source_boundary'] is False


def test_public_export_rejects_private_unknown_modified_and_duplicate_inputs():
    case, answer = fixture()
    row = {'id':case['id'],'inquiry':case['inquiry'],'handoff':answer}
    assert_public_export([row],{'data_classification':'authored-fictional'})
    with pytest.raises(ValueError): assert_public_export([row],{'data_classification':'private'})
    with pytest.raises(ValueError): assert_public_export([{**row,'inquiry':'Real customer message'}],{'data_classification':'authored-fictional'})
    with pytest.raises(ValueError): assert_public_export([{**row,'id':'UNKNOWN'}],{'data_classification':'authored-fictional'})
    with pytest.raises(ValueError): assert_public_export([row,row],{'data_classification':'authored-fictional'})


def test_regrading_did_not_change_any_model_answer():
    original=json.loads((HERE/'results/latest.json').read_text(encoding='utf-8'))
    revised=json.loads((HERE/'results/regraded.json').read_text(encoding='utf-8'))
    assert [(r['id'],r['inquiry'],r['handoff']) for r in original['rows']] == [(r['id'],r['inquiry'],r['handoff']) for r in revised['rows']]
    assert revised['summary']['all_checks_passed'] == {'passed':39,'total':40}


def test_reported_regrade_reproduces_with_current_checks_and_provenance():
    saved = json.loads((HERE/'results/regraded.json').read_text(encoding='utf-8'))
    cases = {c['id']: c for line in (HERE/'dataset.jsonl').read_text(encoding='utf-8').splitlines() for c in [json.loads(line)]}
    rows = [{**row, 'checks':grade_case(cases[row['id']]['expected'],row['handoff'],cases[row['id']].get('forbid'))} for row in saved['rows']]
    assert summarize(rows) == saved['summary']
    assert saved['meta']['grader_sha256'] == file_hash(HERE/'grading.py')
    assert saved['meta']['dataset_sha256'] == file_hash(HERE/'dataset.jsonl')
    assert saved['meta']['source_run_sha256'] == file_hash(HERE/'results/20261101T200215Z-claude-opus-5-5-medium.json')
    assert saved['meta']['hash_format'] == 'sha256-utf8-lf'
    class TextFile:
        def __init__(self, data): self.data = data
        def read_bytes(self): return self.data
    assert file_hash(TextFile(b'first\r\nsecond\r\n')) == file_hash(TextFile(b'first\nsecond\n'))


def test_external_dataset_can_be_read_without_copying_into_public_repository():
    from run_eval import load_dataset
    class PrivateSource:
        def read_text(self, encoding):
            assert encoding == 'utf-8'
            return json.dumps({'id':'PRIVATE-01','inquiry':'Private fixture'})+'\n'
    rows = load_dataset(None,PrivateSource())
    assert rows[0]['id'] == 'PRIVATE-01'
    with pytest.raises(ValueError): assert_public_export(rows,{'data_classification':'authored-fictional'})
