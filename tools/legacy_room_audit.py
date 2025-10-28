#!/usr/bin/env python3
"""Scan the source tree for lingering references to the legacy Room-based vault stack.

The migration to the file-backed vault repository is still in progress. This utility helps
identify Kotlin source files that continue to rely on the Room-powered implementation so we
can prioritize follow-up work.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Optional

# --- Configuration -------------------------------------------------------------------------

DEFAULT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EXTENSIONS = {".kt", ".kts", ".java", ".xml"}
EXCLUDED_DIR_NAMES = {".git", "build", "node_modules", ".gradle", "audit_results"}
AUDIT_RESULTS_DIRNAME = Path("docs") / "audit_results"


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
        name="room_imports",
        description="Import statements for Room classes",
        regex=re.compile(r"import.*androidx\\.room|import.*VaultDao|import.*VaultEntity"),
        tags=["imports", "room"],
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
    PatternSpec(
        name="flow_vault_entities",
        description="Flow emissions of Room entities",
        regex=re.compile(r"Flow<.*Vault(Entity|Dao).*>"),
        tags=["reactive", "room"],
    ),
    PatternSpec(
        name="coroutine_dao_calls",
        description="Coroutine calls to DAO methods",
        regex=re.compile(r"suspend\s+fun\s+\w+.*\(.*\).*:\s*(Flow|List)<.*Vault"),
        tags=["coroutines", "room"],
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


def _ensure_results_dir(root: Path) -> Path:
    output_dir = root / AUDIT_RESULTS_DIRNAME
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def _format_human_report(report: Dict[str, object]) -> str:
    totals: Dict[str, int] = report.get("totals", {})  # type: ignore[assignment]
    files: Dict[str, Dict[str, List[Dict[str, object]]]] = report.get("files", {})  # type: ignore[assignment]
    patterns_meta: Dict[str, Dict[str, object]] = report.get("patterns", {})  # type: ignore[assignment]

    lines: List[str] = []
    lines.append("Legacy Room usage report")
    lines.append(f"Root: {report.get('root', '?')}")
    lines.append("")
    lines.append("Summary by pattern:")
    for name, count in sorted(totals.items(), key=lambda item: item[0]):
        meta = patterns_meta.get(name, {})
        description = meta.get("description", "")
        lines.append(f"- {name} ({description}): {count}")
    lines.append("")
    lines.append("Detailed findings:")
    if not files:
        lines.append("  No matches found. 🎉")
        return "\n".join(lines)

    for file_path, findings in sorted(files.items()):
        lines.append(f"- {file_path}")
        for pattern_name, matches in sorted(findings.items()):
            lines.append(f"  • {pattern_name} ({len(matches)} match(es))")
            for match in matches:
                line = match["line"]
                content = match["content"]
                lines.append(f"    L{line}: {content}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def persist_report(report: Dict[str, object], root: Path) -> List[Path]:
    output_dir = _ensure_results_dir(root)
    timestamp = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    base_name = f"{timestamp}_legacy_room_audit"
    text_path = output_dir / f"{base_name}.txt"
    json_path = output_dir / f"{base_name}.json"

    text_path.write_text(_format_human_report(report), encoding="utf-8")
    with json_path.open("w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    return [text_path, json_path]


def print_report(report: Dict[str, object], *, as_json: bool) -> None:
    if as_json:
        json.dump(report, sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")
        return

    sys.stdout.write(_format_human_report(report))


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

    saved_paths = persist_report(report, root)
    print_report(report, as_json=args.json)
    print("Report saved to:")
    for path in saved_paths:
        print(f"- {path.relative_to(root)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
