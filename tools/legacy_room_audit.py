#!/usr/bin/env python3
"""Scan the source tree for lingering references to the legacy Room-based vault stack.

The migration to the file-backed vault repository is still in progress. This utility helps
identify Kotlin source files that continue to rely on the Room-powered implementation so we
can prioritize follow-up work.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Optional

# --- Configuration -------------------------------------------------------------------------

DEFAULT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EXTENSIONS = {".kt", ".kts", ".java", ".xml"}
EXCLUDED_DIR_NAMES = {".git", "build", "node_modules", ".gradle"}


@dataclass(frozen=True)
class PatternSpec:
    """Definition of a search pattern."""

    name: str
    description: str
    regex: re.Pattern[str]
    excludes: List[Path] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)

    def matches(self, path: Path, line: str) -> bool:
        if any(path == exclude or exclude in path.parents for exclude in self.excludes):
            return False
        return bool(self.regex.search(line))


PATTERNS: List[PatternSpec] = [
    PatternSpec(
        name="legacy_vault_repository",
        description="References to the Room-backed VaultRepository",
        regex=re.compile(r"\bVaultRepository\b"),
        excludes=[
            Path("android/app/src/main/java/com/julien/genpwdpro/data/repository/VaultRepository.kt"),
        ],
        tags=["legacy", "room"],
    ),
    PatternSpec(
        name="room_database_builder",
        description="Direct references to androidx.room APIs",
        regex=re.compile(r"androidx\\.room|Room\\.databaseBuilder"),
        tags=["room", "database"],
    ),
    PatternSpec(
        name="room_annotations",
        description="Usage of Room annotations (Entity, Dao, Query, Database)",
        regex=re.compile(r"@Database|@Entity|@Dao|@Query"),
        tags=["room", "annotations"],
    ),
    PatternSpec(
        name="app_database_singletons",
        description="References to AppDatabase (Room concrete DB)",
        regex=re.compile(r"\bAppDatabase\b"),
        tags=["room", "database"],
    ),
]


# --- Core logic ----------------------------------------------------------------------------

def iter_source_files(root: Path, *, extensions: Iterable[str]) -> Iterator[Path]:
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix not in extensions:
            continue
        if any(part in EXCLUDED_DIR_NAMES for part in path.parts):
            continue
        yield path


def scan_file(path: Path, patterns: Iterable[PatternSpec]) -> Dict[str, List[Dict[str, object]]]:
    findings: Dict[str, List[Dict[str, object]]] = {}
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        text = path.read_text(encoding="utf-8", errors="ignore")

    for idx, line in enumerate(text.splitlines(), start=1):
        for pattern in patterns:
            if pattern.matches(path, line):
                findings.setdefault(pattern.name, []).append(
                    {"line": idx, "content": line.strip()}
                )
    return findings


def build_report(root: Path, selected_patterns: Optional[List[str]] = None) -> Dict[str, object]:
    patterns = [p for p in PATTERNS if selected_patterns is None or p.name in selected_patterns]
    if not patterns:
        raise SystemExit("No patterns selected for the scan")

    report: Dict[str, object] = {
        "root": str(root),
        "patterns": {p.name: {"description": p.description, "tags": p.tags} for p in patterns},
        "files": {},
        "totals": {p.name: 0 for p in patterns},
    }

    for file_path in iter_source_files(root, extensions=DEFAULT_EXTENSIONS):
        file_findings = scan_file(file_path, patterns)
        if not file_findings:
            continue
        report["files"][str(file_path.relative_to(root))] = file_findings
        for pattern_name, matches in file_findings.items():
            report["totals"][pattern_name] += len(matches)

    return report


def print_report(report: Dict[str, object], *, as_json: bool) -> None:
    if as_json:
        json.dump(report, sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")
        return

    totals: Dict[str, int] = report.get("totals", {})  # type: ignore[assignment]
    files: Dict[str, Dict[str, List[Dict[str, object]]]] = report.get("files", {})  # type: ignore[assignment]
    patterns_meta: Dict[str, Dict[str, object]] = report.get("patterns", {})  # type: ignore[assignment]

    print("Legacy Room usage report")
    print("Root:", report.get("root", "?"))
    print()
    print("Summary by pattern:")
    for name, count in sorted(totals.items(), key=lambda item: item[0]):
        meta = patterns_meta.get(name, {})
        description = meta.get("description", "")
        print(f"- {name} ({description}): {count}")
    print()
    print("Detailed findings:")
    if not files:
        print("  No matches found. 🎉")
        return

    for file_path, findings in sorted(files.items()):
        print(f"- {file_path}")
        for pattern_name, matches in sorted(findings.items()):
            print(f"  • {pattern_name} ({len(matches)} match(es))")
            for match in matches:
                line = match["line"]
                content = match["content"]
                print(f"    L{line}: {content}")
        print()


# --- CLI -----------------------------------------------------------------------------------

def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=DEFAULT_ROOT,
        help="Repository root to scan (defaults to project root)",
    )
    parser.add_argument(
        "--pattern",
        action="append",
        help="Name of a pattern to include. Repeat to scan multiple specific patterns.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit the report as JSON instead of human-readable text.",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    root = args.root.resolve()
    if not root.exists():
        print(f"Root directory does not exist: {root}", file=sys.stderr)
        return 2

    try:
        report = build_report(root, selected_patterns=args.pattern)
    except Exception as exc:  # pragma: no cover - defensive logging
        print(f"Failed to build report: {exc}", file=sys.stderr)
        return 1

    print_report(report, as_json=args.json)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
