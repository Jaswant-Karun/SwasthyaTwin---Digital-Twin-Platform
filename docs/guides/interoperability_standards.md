# FHIR Interoperability Mapping Guidelines

Guidance for mapping SwasthyaTwin schemas to HL7 FHIR Release 4 resources.

- `PatientProfile` -> `Patient` resource
- `BiomarkerRecord` -> `Observation` resource with standard SNOMED-CT / LOINC codes
- `HealthRiskAssessment` -> `RiskAssessment` resource
- `WhatIfScenario` -> `CarePlan` activity proposal
