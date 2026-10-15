# Database Connection Pooling & Failover Runbook

## High Availability Configuration
- MongoDB Replica Set with automated failover election.
- Motor client initializes with `retryWrites=true&w=majority`.
- Graceful degradation: in-memory fallback cache preserves recent twin snapshots during brief disconnects.
