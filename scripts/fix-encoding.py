#!/usr/bin/env python
"""
Fix common UTF-8 mojibake sequences in text files.
Includes typical Latin-1/UTF-8 issues and CP1252/CP850 confusion.
Safe for mixed content; preserves non-Latin1 characters.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import re
import sys


DEFAULT_EXTS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".md",
    ".html",
    ".css",
    ".scss",
    ".txt",
    ".sql",
    ".yml",
    ".yaml",
}

DEFAULT_EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "temp",
    "assets",
}

# Match mojibake sequences created by UTF-8 bytes decoded as Latin-1.
# Covers 2-byte (C2-DF), 3-byte (E0-EF), and 4-byte (F0-F4) lead bytes.
MOJIBAKE_RE = re.compile(r"[\u00c2-\u00f4][\u0080-\u00bf]{1,3}")

# CP1252 control range characters often produced by encoding confusion.
CP1252_CONTROL_RE = re.compile(r"[\u0080-\u009f]")

# CP1252 symbols that are uncommon in this codebase but appear in mojibake.
CP1252_SYMBOL_RE = re.compile(
    r"[\u00a0\u00a1\u00a2\u00a3\u00a4\u00a6\u00a7\u00a8\u00ab\u00ac\u00ad\u00ae"
    r"\u00af\u00b0\u00b1\u00b4\u00b5\u00b6\u00b7\u00b8\u00bb\u00bf\u00c6\u00d0"
    r"\u00d7\u00d8\u00de\u00f0\u00f7\u00f8\u00fe]"
)

# CP850->CP1252 double mojibake patterns (e.g., "Çœ").
CP850_PAIR_RE = re.compile(r"\u00c7[\u0153\u00f5\u00e6\u00ad\u00b8\u00a6\u00f0\u00fc]")

NON_ASCII_RE = re.compile(r"[^\x00-\x7f]+")


def fix_utf8_mojibake(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        s = match.group(0)
        try:
            return s.encode("latin1").decode("utf-8")
        except UnicodeError:
            try:
                return s.encode("latin1").decode("utf-8", errors="ignore")
            except UnicodeError:
                return s

    prev = None
    while text != prev:
        prev = text
        text = MOJIBAKE_RE.sub(repl, text)
    return text


def score_text(text: str) -> int:
    score = 0
    score += len(MOJIBAKE_RE.findall(text))
    score += len(CP1252_CONTROL_RE.findall(text))
    score += len(CP1252_SYMBOL_RE.findall(text))
    score += len(CP850_PAIR_RE.findall(text))
    score += text.count("\ufffd")
    return score


def fix_text(text: str) -> str:
    def fix_run(match: re.Match[str]) -> str:
        run = match.group(0)
        if score_text(run) == 0:
            return run

        try:
            decoded = run.encode("cp1252").decode("cp850")
        except UnicodeError:
            return run

        decoded = fix_utf8_mojibake(decoded)
        if score_text(decoded) < score_text(run):
            return decoded
        return run

    text = NON_ASCII_RE.sub(fix_run, text)
    text = fix_utf8_mojibake(text)
    return text


def should_skip(rel_path: Path, exclude_dirs: set[str]) -> bool:
    return any(part in exclude_dirs for part in rel_path.parts)


def process_file(path: Path, root: Path, backup_dir: Path | None, dry_run: bool) -> bool:
    data = path.read_bytes()
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return False

    if (
        not MOJIBAKE_RE.search(text)
        and not CP1252_CONTROL_RE.search(text)
        and not CP1252_SYMBOL_RE.search(text)
        and not CP850_PAIR_RE.search(text)
    ):
        return False

    fixed = fix_text(text)
    if fixed == text:
        return False

    if not dry_run:
        if backup_dir is not None:
            rel = path.relative_to(root)
            backup_path = backup_dir / rel
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            backup_path.write_bytes(data)
        path.write_bytes(fixed.encode("utf-8"))
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Fix common UTF-8 mojibake in text files.")
    parser.add_argument("--root", default=".", help="Root directory to scan.")
    parser.add_argument("--dry-run", action="store_true", help="List files without writing changes.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit with code 1 if changes would be made (implies --dry-run).",
    )
    parser.add_argument(
        "--backup-dir",
        default=None,
        help="If set, write original files under this directory.",
    )
    parser.add_argument(
        "--ext",
        action="append",
        default=None,
        help="File extension to include (repeatable, e.g. --ext .ts).",
    )
    args = parser.parse_args()

    if args.check:
        args.dry_run = True

    root = Path(args.root).resolve()
    exts = set(args.ext) if args.ext else DEFAULT_EXTS
    exclude_dirs = set(DEFAULT_EXCLUDE_DIRS)

    backup_dir = Path(args.backup_dir).resolve() if args.backup_dir else None

    changed = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(root)
        if should_skip(rel, exclude_dirs):
            continue
        if path.suffix.lower() not in exts:
            continue
        if process_file(path, root, backup_dir, args.dry_run):
            changed.append(rel.as_posix())

    for rel in changed:
        print(rel)

    print(f"changed_files={len(changed)}")
    if args.check and changed:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
