# Legacy Room audit snapshots

This directory stores timestamped outputs produced by `tools/legacy_room_audit.py`.

Each run persists two files:

- `<timestamp>_legacy_room_audit.txt` – human-readable summary.
- `<timestamp>_legacy_room_audit.json` – structured data for tooling.

Timestamps are emitted in UTC using the format `YYYY-MM-DD_HH-MM-SS` to make it easy to compare
progress over time. Older snapshots can be removed when they are no longer needed, but keeping a
chronological history helps quantify migration progress.
