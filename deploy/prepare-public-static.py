#!/usr/bin/env python3
"""Create a sanitized, non-existing static-root stage from Tasked public assets."""
from __future__ import annotations

import argparse
import os
import shutil
import stat
from pathlib import Path


def prepare(source: Path, destination: Path) -> int:
    source = source.resolve(strict=True)
    if not source.is_dir() or destination.exists() or destination.is_symlink():
        raise ValueError("source must be a directory and destination must not exist")
    destination.parent.mkdir(parents=True, exist_ok=True)
    copied = 0

    def ignore(directory: str, names: list[str]) -> set[str]:
        return {name for name in names if name.startswith("._") or name == ".DS_Store" or name == "__MACOSX"}

    try:
        for path in source.rglob("*"):
            if path.is_symlink():
                raise ValueError(f"symlink is not allowed in public assets: {path.relative_to(source)}")
        shutil.copytree(source, destination, copy_function=shutil.copy2, ignore=ignore)
        for path in destination.rglob("*"):
            if path.is_file():
                copied += 1
        return copied
    except Exception:
        if destination.exists():
            shutil.rmtree(destination)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path, help="new sibling stage path; must not exist")
    args = parser.parse_args()
    count = prepare(args.source, args.destination)
    print(f"staged {count} publishable files at {args.destination}")


if __name__ == "__main__":
    main()

