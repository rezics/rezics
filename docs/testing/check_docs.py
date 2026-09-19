"""Check maintained documentation links, English prose and current ownership.

Read-only; includes tracked and non-ignored untracked Markdown so it works before
staging. Source/localization examples inside code fences remain exact data.
"""

from __future__ import annotations

import re
import json
import hashlib
import subprocess
import sys
import unicodedata
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
RETIRED = ("docs/report/", "docs/plan/pending-review/", "docs/plan/operational-refactor-20260906/", "docs/plan/database-schema-design-20260910/")
RETIRED_FILES = {
    "unit-slug-addressing.md", "unit-landing-seo.md", "unit-metadata-only.md",
    "unit-license-grants.md", "unit-subject-association-reading.md",
    "realm-collection-zone.md", "zone-composition-and-theming-decisions.md",
    "entity-tag-spoiler-and-measurement-decisions.md",
}
TARGET_PREFIXES = ("docs/architecture/", "docs/plan/", "docs/research/", "docs/next-version/")
POLICY_SECTIONS = {
    "docs/README.md": ("start-here", "document-roles", "implementation-and-verification"),
    "docs/architecture/README.md": ("model-and-ownership", "domain-contracts", "reading-rules"),
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
                fence = (marker[0], len(marker))
            elif fence[0] == marker[0] and len(marker) >= fence[1] and not line[match.end():].strip():
                fence = None
            yield number, ""
        else:
            yield number, "" if fence else line


def document_role(name):
    if name == "docs/architecture/database/capacity.md" or "/generated/" in name:
        return "generated"
    for prefix, role in (
        ("docs/architecture/", "target"), ("docs/plan/", "execution"),
        ("docs/testing/", "acceptance/evidence"), ("docs/reference/", "implementation"),
        ("docs/releases/", "release"), ("docs/legal/", "legal"),
        ("docs/research/", "research"), ("docs/next-version/", "proposal"),
        ("docs/operations/", "operations"), (".agents/", "agent instructions"),
        ("services/", "implementation"), ("libraries/", "package contract"),
        ("packages/", "package contract"), ("apps/", "application guide"),
    ):
        if name.startswith(prefix):
            return role
    return "repository guide"


def terminology_problems(name, text):
    """Guard definite retired target terms; preserve code, standards and evidence.

    This is a drift check, not a semantic proof. Entity and Profile are valid
    generic/model vocabulary, so only public-actor uses are rejected.
    """
    if not name.startswith(TARGET_PREFIXES):
        return []
    problems = []
    for number, line in visible_lines(text):
        prose = re.sub(r"(`+).*?\1", "", line)
        prose = re.sub(r"\]\([^)]*\)", "]", prose)
        for pattern, message in (
            (r"\bUnits?\b", "retired logical Unit prose; use Resource or quote an exact implementation identifier"),
            (r"\b(?:public|main|selected|operating|authorizing) (?:Entity|Entities|Profile|Profiles)\b", "public actor contract uses Agent"),
            (r"\bProfile selector\b|\beligible Profiles\b", "public actor contract uses Agent"),
            (r"\b[aA]n Resource\b|\b[aA] Agent\b", "incorrect article after model terminology change"),
            (r"At 3B rows, application sharding is mandatory", "row count does not mandate a database split"),
        ):
            if re.search(pattern, prose):
                problems.append(f"{name}:{number}: {message}")
    return problems


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
    # Upstream machine-schema Markdown is an exact pinned input. Its relative
    # links belong to its upstream repository, not our maintained documentation.
    source_pins = json.loads((ROOT / "libraries/content-adapters/contracts/catalog/artifacts.lock.json").read_text())
    upstream_docs = {f"libraries/content-adapters/contracts/{entry['source']}/inputs/{entry['file']}": entry["sha256"] for entry in source_pins if entry["file"].endswith(".md")}
    checked_links = 0
    anchor_cache = {}
    local_targets = {}
    roles = {}
    for path in docs:
        name = path.relative_to(ROOT).as_posix()
        if name in upstream_docs:
            if hashlib.sha256(path.read_bytes()).hexdigest() != upstream_docs[name]:
                problems.append(f"{name}: pinned upstream documentation bytes changed")
            continue
        text = path.read_text(encoding="utf-8")
        role = document_role(name)
        roles[role] = roles.get(role, 0) + 1
        problems.extend(terminology_problems(name, text))
        if name.startswith("docs/architecture/") and path.name in RETIRED_FILES:
            problems.append(f"{name}: retired target filename")
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
    print(f"Documentation integrity PASS: {len(docs)} Markdown files, {checked_links} local links; role/terminology drift, English prose and policy structure checked.")
    print("Document roles: " + json.dumps(roles, sort_keys=True))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
