import pytest

from iroyin_benchmark.scoring import cer, entity_prf, report_integrity_score, switch_window_wer, wer


def test_wer_and_cer_are_zero_for_equivalent_normalized_text():
    assert wer("The cable dey burn!", "the cable dey burn") == 0
    assert cer("₦ 5,000", "NGN 5 000") == 0


def test_switch_window_wer_counts_local_substitution():
    score = switch_window_wer("we report transformer spark since yesterday", "we report generator spark since yesterday", [2], radius=1)
    assert score == pytest.approx(1 / 3)


def test_entity_prf():
    result = entity_prf(["Surulere", "NGN 180000"], ["surulere", "Ikeja"])
    assert result == {"precision": 0.5, "recall": 0.5, "f1": 0.5}


def test_ris_requires_exact_evidence_in_evaluated_transcript():
    reference = [
        {"category": "location", "value": "Surulere"},
        {"category": "event_or_action", "value": "transformer sparked"},
    ]
    predicted = [
        {"field": "location", "value": "Surulere", "evidenceQuote": "Surulere"},
        {"field": "event_or_action", "value": "transformer sparked", "evidenceQuote": "transformer sparked"},
    ]
    result = report_integrity_score(reference, predicted, "The transformer sparked yesterday")
    assert result["score"] == pytest.approx(5 / 9 * 100)
    assert result["unsupportedHallucinations"] == 1


def test_provider_failure_is_retained_as_zero():
    result = report_integrity_score(
        [{"category": "incident_type", "value": "hazard"}],
        [],
        "",
        provider_failed=True,
    )
    assert result["score"] == 0
