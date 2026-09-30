"""Rules-based alerts. NOT diagnoses. Label: 'Clinical alert — requires professional assessment.'"""
DISCLAIMER = "Clinical alert — requires professional assessment."
SEVERE_WORDS = ("chest pain", "shortness of breath", "unconscious", "severe bleeding", "seizure")

def evaluate(enc, allergies=(), new_meds=()):
    flags = []
    if enc.spo2 is not None and enc.spo2 < 92: flags.append(("LOW_SPO2", f"SpO2 {enc.spo2}% is low", "HIGH"))
    if enc.temperature_c is not None and enc.temperature_c >= 39.5: flags.append(("HIGH_TEMP", f"Temperature {enc.temperature_c}°C is very high", "HIGH"))
    text = f"{enc.chief_complaint or ''} {enc.symptoms or ''}".lower()
    for w in SEVERE_WORDS:
        if w in text: flags.append(("SEVERE_SYMPTOM", f"Reported: {w}", "HIGH"))
    for a in allergies:
        if a.severity in ("SEVERE", "ANAPHYLAXIS"): flags.append(("SEVERE_ALLERGY", f"Known severe allergy: {a.substance}", "HIGH"))
        for m in new_meds:
            if a.substance.lower() in m.lower(): flags.append(("MED_ALLERGY_CONFLICT", f"'{m}' may conflict with recorded allergy to {a.substance}", "HIGH"))
    return [{"code": c, "message": m, "severity": s, "disclaimer": DISCLAIMER} for c, m, s in flags]
