#!/usr/bin/env python3
"""Crea en GitHub los issues definidos en scripts/issues.json.

Requiere `gh auth login` y que las etiquetas existan (bash scripts/create_labels.sh).
Es seguro repetirlo: omite los issues cuyo título ya existe.

Uso:
  python scripts/create_issues.py --dry-run          # solo muestra lo que haría
  python scripts/create_issues.py                    # crea los issues
  python scripts/create_issues.py --repo OWNER/REPO
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_REPO = "VainstubTomas/NASA-APP-CHALLENGE"


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def layer_label(layer):
    return "capa:entrega" if layer == 9 else f"capa:{layer}"


def layer_name(layer):
    return "Entrega" if layer == 9 else f"Capa {layer}"


def body(issue):
    lines = [f"**ID:** {issue['id']}", "", "## Contexto", issue["context"], "", "## Criterio de aceptación"]
    lines += [f"- [ ] {a}" for a in issue["acceptance"]]
    lines += ["", "## Notas", "Ver `docs/05-ROADMAP.md` y `docs/03-DATA-CONTRACT.md`. Rama: `feature/<n>-<slug>` desde `dev`."]
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=DEFAULT_REPO)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    issues = json.loads((HERE / "issues.json").read_text(encoding="utf-8"))

    existing = set()
    if not args.dry_run:
        r = run(["gh", "issue", "list", "--repo", args.repo, "--state", "all", "--limit", "500", "--json", "title"])
        if r.returncode != 0:
            sys.exit(f"No pude listar issues (¿gh auth login?): {r.stderr.strip()}")
        existing = {i["title"] for i in json.loads(r.stdout)}

    for issue in issues:
        title = f"[{layer_name(issue['layer'])}] {issue['id']}: {issue['title']}"
        labels = [layer_label(issue["layer"]), f"area:{issue['area']}", f"tamaño:{issue['size']}"]
        if title in existing:
            print(f"= ya existe: {title}")
            continue
        if args.dry_run:
            print(f"+ {title}  [{', '.join(labels)}]")
            continue
        cmd = ["gh", "issue", "create", "--repo", args.repo, "--title", title, "--body", body(issue)]
        for label in labels:
            cmd += ["--label", label]
        r = run(cmd)
        print(("+ " if r.returncode == 0 else "! ") + title + ("" if r.returncode == 0 else f"  -> {r.stderr.strip()}"))


if __name__ == "__main__":
    main()
