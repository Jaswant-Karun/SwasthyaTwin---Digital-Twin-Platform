# Error Handling & Standard Responses

Standard RFC-7807 problem details response schema:

```json
{
  "type": "https://swasthyatwin.internal/errors/invalid-biomarker",
  "title": "Biomarker Value Out of Physical Bounds",
  "status": 422,
  "detail": "Fasting blood glucose cannot be negative (-10 mg/dL).",
  "instance": "/api/v1/twins/PT-101/vitals"
}
```
