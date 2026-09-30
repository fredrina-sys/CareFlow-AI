"""AI abstraction. Assistant only: every output is AI_GENERATED and needs doctor verification."""
from typing import Protocol
from app.core.config import settings

REQUIRED_NOTICE = "AI-generated clinical summary — requires doctor verification."

class SummaryProvider(Protocol):
    def summarize(self, ctx: dict) -> dict: ...

class MockProvider:
    """Deterministic: same input -> same output. No network, no key."""
    def summarize(self, ctx: dict) -> dict:
        p = ctx.get("patient", {})
        diagnoses = ctx.get("diagnoses", []); meds = ctx.get("medications", []); allergies = ctx.get("allergies", [])
        labs = ctx.get("investigations", []); notes = ctx.get("notes", []); flags = ctx.get("red_flags", [])
        complaint = ctx.get("chief_complaint") or "not recorded"
        qs = ["When did the symptoms start and how have they changed?"]
        if allergies: qs.append("Any reaction to the recorded allergens since the last visit?")
        if meds: qs.append("Is the patient taking the listed medications as prescribed?")
        return {"notice": REQUIRED_NOTICE,
                "patient_context": f"{p.get('name','Patient')}, {p.get('age','?')}y, {p.get('gender','?')}",
                "relevant_history": [d["name"] for d in diagnoses],
                "current_complaints": [complaint] + ([ctx["symptoms"]] if ctx.get("symptoms") else []),
                "known_allergies": [a["substance"] for a in allergies],
                "active_medications": meds, "previous_diagnoses": [f"{d['name']} ({d['status']})" for d in diagnoses],
                "recent_investigations": labs,
                "important_notes": [n["text"] for n in notes if n.get("type") == "IMPORTANT_FOR_FUTURE_DOCTORS"],
                "potential_red_flags": [f["message"] for f in flags],
                "suggested_questions_for_doctor": qs}

class ExternalLLMProvider:
    """Plug a real LLM in here (read the key from env, never hard-code). Keep the same output schema."""
    def summarize(self, ctx: dict) -> dict:
        raise NotImplementedError("Connect an LLM API here; set AI_PROVIDER=llm")

def get_provider() -> SummaryProvider:
    return MockProvider() if settings.AI_PROVIDER == "mock" else ExternalLLMProvider()
