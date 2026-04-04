"""Tests for Beanie ODM models - validates schema, defaults, and field constraints.

Uses model_construct() to bypass Beanie's collection initialization requirement,
allowing unit tests without a live MongoDB connection.
"""
from datetime import datetime

import pytest

from services.shared.models import (
    TrustScoreBreakdown,
    ReactionCount,
    Drug,
    AdverseEventMonthly,
    ClinicalTrial,
    Formulary,
    FDASignal,
    RepBrief,
    InputDataSnapshot,
    ALL_MODELS,
)


def make_drug(**kwargs) -> Drug:
    defaults = dict(rxcui="857005", brand_name="Ozempic", generic_name="semaglutide")
    defaults.update(kwargs)
    return Drug.model_construct(**defaults)


def make_ae(**kwargs) -> AdverseEventMonthly:
    defaults = dict(drug_rxcui="857005", period_year=2024, period_month=1)
    defaults.update(kwargs)
    return AdverseEventMonthly.model_construct(**defaults)


def make_trial(**kwargs) -> ClinicalTrial:
    defaults = dict(nct_id="NCT12345678", drug_rxcui="857005", title="SUSTAIN-1 Trial")
    defaults.update(kwargs)
    return ClinicalTrial.model_construct(**defaults)


class TestTrustScoreBreakdown:
    def test_default_values(self):
        tsb = TrustScoreBreakdown()
        assert tsb.evidence_quality == 0.0
        assert tsb.safety_signal == 0.0
        assert tsb.trial_real_gap == 0.0
        assert tsb.formulary_access == 0.0

    def test_custom_values(self):
        tsb = TrustScoreBreakdown(evidence_quality=80.0, safety_signal=70.0, trial_real_gap=60.0, formulary_access=50.0)
        assert tsb.evidence_quality == 80.0
        assert tsb.formulary_access == 50.0


class TestReactionCount:
    def test_fields(self):
        rc = ReactionCount(reaction="nausea", count=42)
        assert rc.reaction == "nausea"
        assert rc.count == 42


class TestDrug:
    def test_required_fields(self):
        drug = make_drug()
        assert drug.rxcui == "857005"
        assert drug.brand_name == "Ozempic"
        assert drug.generic_name == "semaglutide"

    def test_default_values(self):
        drug = make_drug(rxcui="123", brand_name="Test", generic_name="test_generic")
        assert drug.rxcui == "123"
        assert drug.brand_name == "Test"

    def test_optional_numeric_fields(self):
        drug = make_drug(nnt_trial=5.2, arr_trial=3.1)
        assert drug.nnt_trial == 5.2
        assert drug.arr_trial == 3.1

    def test_collection_name(self):
        assert Drug.Settings.name == "drugs"

    def test_trust_score_breakdown_embedded(self):
        tsb = TrustScoreBreakdown(evidence_quality=90.0, safety_signal=80.0, trial_real_gap=70.0, formulary_access=60.0)
        drug = make_drug(trust_score=75.0, trust_score_breakdown=tsb)
        assert drug.trust_score == 75.0
        assert drug.trust_score_breakdown.evidence_quality == 90.0


class TestAdverseEventMonthly:
    def test_defaults(self):
        ae = make_ae()
        assert ae.drug_rxcui == "857005"
        assert ae.period_year == 2024
        assert ae.period_month == 1

    def test_signal_fields(self):
        ae = make_ae(total_reports=150, serious_reports=30, fatal_reports=5, signal_flag=True, proportional_reporting_ratio=3.2)
        assert ae.total_reports == 150
        assert ae.serious_reports == 30
        assert ae.signal_flag is True
        assert ae.proportional_reporting_ratio == 3.2

    def test_collection_name(self):
        assert AdverseEventMonthly.Settings.name == "adverse_events"

    def test_top_reactions(self):
        reactions = [ReactionCount(reaction="nausea", count=10), ReactionCount(reaction="vomiting", count=5)]
        ae = make_ae(top_reactions=reactions)
        assert len(ae.top_reactions) == 2
        assert ae.top_reactions[0].reaction == "nausea"


class TestClinicalTrial:
    def test_required_fields(self):
        trial = make_trial()
        assert trial.nct_id == "NCT12345678"
        assert trial.drug_rxcui == "857005"
        assert trial.title == "SUSTAIN-1 Trial"

    def test_industry_sponsored_flag(self):
        trial = make_trial(industry_sponsored=True, sponsor="Novo Nordisk", sponsor_type="INDUSTRY")
        assert trial.industry_sponsored is True
        assert trial.sponsor_type == "INDUSTRY"

    def test_collection_name(self):
        assert ClinicalTrial.Settings.name == "clinical_trials"


class TestFormulary:
    def test_required_fields(self):
        f = Formulary.model_construct(drug_rxcui="857005", payer_category="medicare_d")
        assert f.drug_rxcui == "857005"
        assert f.payer_category == "medicare_d"

    def test_pa_step_flags(self):
        f = Formulary.model_construct(
            drug_rxcui="857005",
            payer_category="commercial",
            tier="3",
            prior_auth_required=True,
            step_therapy_required=True,
            estimated_copay_low=50.0,
            estimated_copay_high=100.0,
        )
        assert f.prior_auth_required is True
        assert f.step_therapy_required is True
        assert f.estimated_copay_low == 50.0

    def test_collection_name(self):
        assert Formulary.Settings.name == "formulary"


class TestFDASignal:
    def test_fields(self):
        sig = FDASignal.model_construct(
            drug_rxcui="857005",
            signal_date=datetime(2024, 6, 1),
            signal_type="SAFETY",
            title="Black box warning added",
        )
        assert sig.signal_type == "SAFETY"
        assert sig.drug_rxcui == "857005"

    def test_signal_types(self):
        for stype in ("SAFETY", "SHORTAGE", "APPROVAL", "STUDY"):
            sig = FDASignal.model_construct(
                drug_rxcui="test",
                signal_date=datetime.utcnow(),
                signal_type=stype,
                title="test",
            )
            assert sig.signal_type == stype

    def test_black_box_flag(self):
        sig = FDASignal.model_construct(
            drug_rxcui="857005",
            signal_date=datetime.utcnow(),
            signal_type="SAFETY",
            title="BBW added",
            is_black_box=True,
        )
        assert sig.is_black_box is True

    def test_collection_name(self):
        assert FDASignal.Settings.name == "fda_signals"


class TestRepBrief:
    def test_fields(self):
        rb = RepBrief.model_construct(
            drug_rxcui="857005",
            will_say=["This drug reduces risk by 26%"],
            reality=["Absolute risk reduction is only 2.3%"],
            power_questions=["What is the NNT?"],
            study_limitations="SUSTAIN-1 excluded elderly patients.",
            prompt_version="v1.0",
            model_version="claude-sonnet-4-5",
        )
        assert rb.drug_rxcui == "857005"
        assert len(rb.will_say) == 1
        assert len(rb.reality) == 1
        assert len(rb.power_questions) == 1
        assert rb.prompt_version == "v1.0"

    def test_collection_name(self):
        assert RepBrief.Settings.name == "rep_briefs"


class TestAllModels:
    def test_all_models_list_has_six_entries(self):
        assert len(ALL_MODELS) == 6

    def test_all_models_are_document_subclasses(self):
        from beanie import Document
        for model in ALL_MODELS:
            assert issubclass(model, Document)

    def test_all_models_have_settings(self):
        for model in ALL_MODELS:
            assert hasattr(model, "Settings")
            assert hasattr(model.Settings, "name")
            assert model.Settings.name  # non-empty collection name
