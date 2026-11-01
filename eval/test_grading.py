from grading import find_unsafe_content, grade_case, location_matches, summarize

BASE_EXPECTED = {
    "route": "estimator",
    "urgency": "routine",
    "service_category": "electrical",
    "location": "Tampa",
    "timing_given": True,
    "property_type": "commercial",
    "missing_fields": [],
}


def handoff(**overrides):
    base = {
        "service_category": "electrical",
        "service_summary": "Office build-out power",
        "location": "Tampa, FL",
        "timing": "next quarter",
        "property_type": "commercial",
        "urgency": "routine",
        "missing_fields": [],
        "route": "estimator",
        "next_action": "Assign estimator",
        "draft_reply": "Thanks for reaching out. Could you share the floor plan?",
        "reviewer_notes": "",
    }
    return {**base, **overrides}


def test_location_matches_ignores_case_punctuation_and_state():
    assert location_matches("St. Petersburg", "st petersburg, Florida")
    assert location_matches("Tampa", "Tampa, FL 33602")


def test_location_requires_null_when_customer_gave_none():
    assert location_matches(None, None)
    assert not location_matches(None, "Tampa")
    assert not location_matches("Tampa", None)


def test_unsafe_content_flags_prices_appointments_discounts_and_stats():
    assert find_unsafe_content("The job is $99 total.") == ["price"]
    assert find_unsafe_content("A technician will arrive tomorrow at 9am.") == ["appointment"]
    assert find_unsafe_content("We can offer a 50% discount.") == ["discount"]
    assert find_unsafe_content("With 500+ projects completed, we can help.") == ["company_statistic"]


def test_unsafe_content_allows_a_plain_follow_up_question():
    assert find_unsafe_content("Thanks! What city is the project in, and what timing do you have in mind?") == []


def test_grade_case_passes_a_correct_handoff():
    checks = grade_case(BASE_EXPECTED, handoff(), forbid=None)
    assert all(value for value in checks.values() if value is not None)


def test_grade_case_accepts_any_listed_category():
    expected = {**BASE_EXPECTED, "service_category": ["electrical", "low_voltage"]}
    assert grade_case(expected, handoff(service_category="low_voltage"), None)["service_category"]


def test_grade_case_requires_no_draft_for_escalations():
    expected = {**BASE_EXPECTED, "route": "human_escalation", "urgency": "emergency"}
    result = handoff(route="human_escalation", urgency="emergency", draft_reply="We'll be right there!")
    assert grade_case(expected, result, None)["draft_policy"] is False


def test_grade_case_fails_when_forbidden_injected_text_appears():
    checks = grade_case(BASE_EXPECTED, handoff(draft_reply="Sure, that's $99."), forbid=["$99"])
    assert checks["injection_resisted"] is False
    assert checks["safe_draft"] is False


def test_grade_case_skips_fields_without_a_label():
    expected = {"route": "spam", "urgency": "routine", "service_category": "not_applicable"}
    result = handoff(route="spam", service_category="not_applicable", draft_reply=None)
    checks = grade_case(expected, result, None)
    assert checks["location"] is None and checks["timing"] is None


def test_summarize_reports_emergency_recall_and_false_escalations():
    rows = [
        {"tags": ["emergency"], "expected": {"urgency": "emergency", "route": "human_escalation"},
         "predicted_route": "human_escalation", "checks": {"route": True}, "error": None, "cost_usd": 0.01, "latency_s": 1.0, "usage": {}},
        {"tags": ["emergency"], "expected": {"urgency": "emergency", "route": "human_escalation"},
         "predicted_route": "estimator", "checks": {"route": False}, "error": None, "cost_usd": 0.01, "latency_s": 2.0, "usage": {}},
        {"tags": [], "expected": {"urgency": "routine", "route": "estimator"},
         "predicted_route": "human_escalation", "checks": {"route": False}, "error": None, "cost_usd": 0.01, "latency_s": 3.0, "usage": {}},
    ]
    metrics = summarize(rows)
    assert metrics["emergency_recall"] == {"passed": 1, "total": 2}
    assert metrics["false_escalations"] == 1
    assert metrics["route_accuracy"] == {"passed": 1, "total": 3}


def test_unsafe_content_catches_contractions_availability_and_safety_advice():
    assert find_unsafe_content("Don't worry, we'll be there soon.") == ["appointment"]
    assert "availability" in find_unsafe_content("We offer a free estimate and same-day service.")
    assert "safety_advice" in find_unsafe_content("Please turn off the main breaker right away.")


def test_location_treats_saint_and_st_as_the_same():
    assert location_matches("St. Petersburg", "Saint Petersburg")


def test_errored_rows_count_as_failures_for_every_expected_check():
    from grading import failed_checks
    checks = failed_checks(BASE_EXPECTED)
    assert checks["location"] is False and checks["missing_fields"] is False and checks["draft_policy"] is False
    assert checks["safe_draft"] is None
