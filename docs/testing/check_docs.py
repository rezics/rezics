"""Check maintained documentation links, English prose and current ownership.

Read-only; includes tracked and non-ignored untracked Markdown so it works before
staging. Source/localization examples inside code fences remain exact data.
"""

from __future__ import annotations

import re
import subprocess
import sys
import unicodedata
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
RETIRED = ("docs/report/", "docs/plan/pending-review/", "docs/plan/operational-refactor-20260906/", "docs/plan/database-schema-design-20260910/")
POLICY_SECTIONS = {
    "docs/plan/README.md": ("active-execution", "acceptance-gates", "modules-and-current-target-qualification"),
    "docs/plan/execution-workflow.md": ("program-authority", "phases-and-transitions", "verification-timing-and-permitted-operations", "progress-commits-and-completion"),
}
POLICY_LINKS = {
    "AGENTS.md": ("docs/plan/README.md", "docs/plan/execution-workflow.md"),
    "CONTRIBUTING.md": ("docs/plan/execution-workflow.md",),
    "docs/plan/README.md": ("docs/plan/execution-workflow.md",),
}


def visible_lines(text):
    fence = None
    for number, line in enumerate(text.splitlines(), 1):
        match = re.match(r"^\s*(`{3,}|~{3,})", line)
        if match:
            marker = match.group(1)
            if fence is None:
                fence = marker[0]
            elif fence == marker[0]:
                fence = None
            yield number, ""
        else:
            yield number, "" if fence else line


def anchors(path):
    text = path.read_text(encoding="utf-8")
    result = set(re.findall(r'<a\s+(?:name|id)=["\']([^"\']+)', text))
    counts = {}
    for _, line in visible_lines(text):
        match = re.match(r"^#{1,6}\s+(.+?)\s*#*$", line)
        if not match:
            continue
        title = re.sub(r"\[([^]]+)\]\([^)]*\)", r"\1", match.group(1))
        slug = "".join(c for c in title.lower() if c in " _-" or unicodedata.category(c)[0] in "LN").replace(" ", "-")
        duplicate = counts.get(slug, 0)
        counts[slug] = duplicate + 1
        result.add(slug if duplicate == 0 else f"{slug}-{duplicate}")
    return result


def main():
    names = set(subprocess.check_output(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=ROOT).decode("utf-8").split("\0"))
    docs = sorted(ROOT / name for name in names if name.endswith(".md") and (ROOT / name).is_file())
    problems = []
    checked_links = 0
    anchor_cache = {}
    local_targets = {}
    for path in docs:
        name = path.relative_to(ROOT).as_posix()
        text = path.read_text(encoding="utf-8")
        for retired in RETIRED:
            if name.startswith(retired):
                problems.append(f"{name}: retired document owner")
        if name.startswith("docs/") and re.search(r"[\u3400-\u9fff]", name):
            problems.append(f"{name}: non-English maintained filename")
        for line_no, line in visible_lines(text):
            if name.startswith("docs/") and re.search(r"[\u3400-\u9fff]", line):
                problems.append(f"{name}:{line_no}: Chinese maintainer prose outside a source-data example")
            for link in re.findall(r"!?\[[^\]\n]*\]\(([^)\n]+)\)", line):
                link = link.strip().strip("<>")
                parsed = urlsplit(link)
                if parsed.scheme or parsed.netloc:
                    continue
                target = (path.parent / unquote(parsed.path)).resolve() if parsed.path else path
                if not target.is_relative_to(ROOT):
                    problems.append(f"{name}:{line_no}: link escapes repository: {link}")
                    continue
                if ".temp" in target.relative_to(ROOT).parts:
                    # Existing operation guides may describe disposable output,
                    # but target/plan/test specs cannot depend on it.
                    if name.startswith(("docs/plan/", "docs/testing/", "docs/architecture/database/")):
                        problems.append(f"{name}:{line_no}: temporary dependency: {link}")
                    continue
                if not target.exists():
                    problems.append(f"{name}:{line_no}: missing local target: {link}")
                    continue
                checked_links += 1
                local_targets.setdefault(name, set()).add(target.relative_to(ROOT).as_posix())
                if parsed.fragment and target.suffix == ".md":
                    allowed = anchor_cache.setdefault(target, anchors(target))
                    if unquote(parsed.fragment) not in allowed:
                        problems.append(f"{name}:{line_no}: missing heading: {link}")
    for name, required_sections in POLICY_SECTIONS.items():
        path = ROOT / name
        if not path.is_file():
            problems.append(f"{name}: missing policy owner")
            continue
        available = anchor_cache.setdefault(path, anchors(path))
        for section in required_sections:
            if section not in available:
                problems.append(f"{name}: missing policy section: {section}")
    for name, required_links in POLICY_LINKS.items():
        for target in required_links:
            if target not in local_targets.get(name, set()):
                problems.append(f"{name}: missing policy reference: {target}")
    if problems:
        print("\n".join(problems))
        raise SystemExit(1)
    print(f"Documentation integrity PASS: {len(docs)} Markdown files, {checked_links} local links; current owners, English prose and policy structure checked.")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
