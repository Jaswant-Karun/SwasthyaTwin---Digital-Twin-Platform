# Wearable Sensor Protocols & Data Streaming Feasibility

## Protocol Comparison
- **MQTT**: Lightweight publish/subscribe ideal for low-bandwidth cellular environments.
- **WebSockets**: Bi-directional full-duplex communication for active clinician desktop monitoring.
- **REST Batching**: Optimized for battery conservation on patient wearable devices (batching 15-minute observation windows).
