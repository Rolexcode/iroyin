from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable, Sequence


RIS_WEIGHTS = {
    "event_or_action": 5,
    "negation": 5,
    "amount_quantity_or_count": 5,
    "actor_or_affected_person": 5,
    "incident_type": 4,
    "location": 4,
    "time_date_or_duration": 3,
    "urgency_or_risk": 3,
    "other_context_or_evidence": 1,
}


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).casefold()
    value = value.replace("₦", " ngn ")
    value = re.sub(r"[^\w\s']", " ", value, flags=re.UNICODE)
    return " ".join(value.split())


def _edit_distance(reference: Sequence[str], hypothesis: Sequence[str]) -> int:
    previous = list(range(len(hypothesis) + 1))
    for ref_token in reference:
        current = [previous[0] + 1]
        for index, hyp_token in enumerate(hypothesis, start=1):
            current.append(min(current[-1] + 1, previous[index] + 1, previous[index - 1] + (ref_token != hyp_token)))
        previous = current
    return previous[-1]


def wer(reference: str, hypothesis: str, *, normalized: bool = True) -> float:
    if normalized:
        reference, hypothesis = normalize_text(reference), normalize_text(hypothesis)
    reference_tokens, hypothesis_tokens = reference.split(), hypothesis.split()
    if not reference_tokens:
        return 0.0 if not hypothesis_tokens else 1.0
    return _edit_distance(reference_tokens, hypothesis_tokens) / len(reference_tokens)


def cer(reference: str, hypothesis: str, *, normalized: bool = True) -> float:
    if normalized:
        reference, hypothesis = normalize_text(reference), normalize_text(hypothesis)
    reference_chars, hypothesis_chars = list(reference), list(hypothesis)
    if not reference_chars:
        return 0.0 if not hypothesis_chars else 1.0
    return _edit_distance(reference_chars, hypothesis_chars) / len(reference_chars)


@dataclass(frozen=True)
class AlignmentOperation:
    kind: str
    reference_index: int


def align_words(reference: Sequence[str], hypothesis: Sequence[str]) -> list[AlignmentOperation]:
    rows, columns = len(reference) + 1, len(hypothesis) + 1
    cost = [[0] * columns for _ in range(rows)]
    for i in range(rows):
        cost[i][0] = i
    for j in range(columns):
        cost[0][j] = j
    for i in range(1, rows):
        for j in range(1, columns):
            cost[i][j] = min(
                cost[i - 1][j] + 1,
                cost[i][j - 1] + 1,
                cost[i - 1][j - 1] + (reference[i - 1] != hypothesis[j - 1]),
            )
    operations: list[AlignmentOperation] = []
    i, j = len(reference), len(hypothesis)
    while i or j:
        if i and j and cost[i][j] == cost[i - 1][j - 1] + (reference[i - 1] != hypothesis[j - 1]):
            operations.append(AlignmentOperation("match" if reference[i - 1] == hypothesis[j - 1] else "substitute", i - 1))
            i, j = i - 1, j - 1
        elif i and cost[i][j] == cost[i - 1][j] + 1:
            operations.append(AlignmentOperation("delete", i - 1))
            i -= 1
        else:
            operations.append(AlignmentOperation("insert", i))
            j -= 1
    return list(reversed(operations))


def switch_window_wer(reference: str, hypothesis: str, switch_indices: Iterable[int], radius: int = 3) -> float:
    ref_tokens = normalize_text(reference).split()
    hyp_tokens = normalize_text(hypothesis).split()
    window = {
        index
        for switch_index in switch_indices
        for index in range(max(0, switch_index - radius), min(len(ref_tokens), switch_index + radius + 1))
    }
    if not window:
        raise ValueError("At least one valid switch token index is required")
    errors = sum(
        operation.kind != "match" and (operation.reference_index in window or (operation.kind == "insert" and operation.reference_index - 1 in window))
        for operation in align_words(ref_tokens, hyp_tokens)
    )
    return errors / len(window)


def entity_prf(reference_entities: Iterable[str], predicted_entities: Iterable[str]) -> dict[str, float]:
    reference = {normalize_text(item) for item in reference_entities if normalize_text(item)}
    predicted = {normalize_text(item) for item in predicted_entities if normalize_text(item)}
    true_positive = len(reference & predicted)
    precision = true_positive / len(predicted) if predicted else (1.0 if not reference else 0.0)
    recall = true_positive / len(reference) if reference else (1.0 if not predicted else 0.0)
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"precision": precision, "recall": recall, "f1": f1}


def report_integrity_score(
    reference_slots: list[dict],
    predicted_facts: list[dict],
    evaluated_transcript: str,
    *,
    provider_failed: bool = False,
) -> dict[str, float | int]:
    if not reference_slots:
        raise ValueError("RIS requires at least one reference slot")
    denominator = 0
    earned = 0
    matched_predictions: set[int] = set()
    transcript_folded = evaluated_transcript.casefold()
    for slot in reference_slots:
        category = slot["category"]
        if category not in RIS_WEIGHTS:
            raise ValueError(f"Unknown RIS category: {category}")
        weight = RIS_WEIGHTS[category]
        denominator += weight
        if provider_failed:
            continue
        acceptable = {normalize_text(slot["value"])}
        acceptable.update(normalize_text(item) for item in slot.get("acceptableValues", []))
        for index, fact in enumerate(predicted_facts):
            quote = str(fact.get("evidenceQuote", ""))
            if (
                fact.get("field") == category
                and normalize_text(str(fact.get("value", ""))) in acceptable
                and quote
                and quote.casefold() in transcript_folded
            ):
                earned += weight
                matched_predictions.add(index)
                break
    hallucinations = sum(
        1
        for index, fact in enumerate(predicted_facts)
        if index not in matched_predictions and fact.get("value")
    )
    return {
        "score": 100 * earned / denominator,
        "earnedWeight": earned,
        "referenceWeight": denominator,
        "unsupportedHallucinations": hallucinations,
    }
