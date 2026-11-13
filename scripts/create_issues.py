#!/usr/bin/env python3
"""Crea en GitHub las épicas y los issues de scripts/issues.json y los agrega al tablero.

Cada capa (fase) del MVP es una épica: un issue padre con título "[EPICA] ..." y la
etiqueta `tipo:epica`. Los issues de esa capa se cuelgan como sub-issues de su épica.
Ver "Épicas" en docs/04-GIT-WORKFLOW.md.

Requiere `gh auth login` con el scope `project` (`gh auth refresh -s project`) y que las
etiquetas existan (bash scripts/create_labels.sh).
En el tablero, las épicas entran en la columna "Todo" y sus issues en "Backlog", con el
campo Size igual al tamaño del issue (S, M o L).
Las dependencias reales de datos (`blocked_by` en issues.json) se cargan como relación
"blocked by" nativa de GitHub. No se usa la columna "Blocked" para eso: esa columna es para
cuando alguien está trabado en un issue que ya empezó (ver docs/04-GIT-WORKFLOW.md).

Es seguro repetirlo: omite los issues cuyo título ya existe, no duplica ítems del tablero
ni sub-issues (los que ya existían también se agregan al tablero y a su épica si faltaban).
La columna y el Size solo se fijan cuando el ítem entra al tablero: si alguien ya lo movió, no se toca.

Uso:
  python scripts/create_issues.py --dry-run          # solo muestra lo que haría
  python scripts/create_issues.py                    # crea todo y lo suma al tablero "Hackaton"
  python scripts/create_issues.py --project 0        # crea todo sin tocar el tablero
  python scripts/create_issues.py --repo OWNER/REPO --owner OWNER --project N
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_REPO = "VainstubTomas/NASA-APP-CHALLENGE"
DEFAULT_OWNER = "VainstubTomas"
DEFAULT_PROJECT = 3  # tablero "Hackaton" en GitHub Projects
EPIC_PREFIX = "[EPICA]"
EPIC_LABEL = "tipo:epica"
EPIC_STATUS = "Todo"
ISSUE_STATUS = "Backlog"


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def layer_label(layer):
    return "capa:entrega" if layer == 9 else f"capa:{layer}"


def layer_name(layer):
    return "Entrega" if layer == 9 else f"Capa {layer}"


def issue_title(issue):
    return f"[{layer_name(issue['layer'])}] {issue['id']}: {issue['title']}"


def epic_title(epic):
    return f"{EPIC_PREFIX} {epic['title']}"


def issue_body(issue):
    lines = [f"**ID:** {issue['id']}", "", "## Contexto", issue["context"], "", "## Criterio de aceptación"]
    lines += [f"- [ ] {a}" for a in issue["acceptance"]]
    if issue.get("blocked_by"):
        lines += ["", "## Depende de", ", ".join(issue["blocked_by"]) + " (relación \"blocked by\" de GitHub)."]
    lines += ["", "## Notas", "Ver `docs/05-ROADMAP.md` y `docs/03-DATA-CONTRACT.md`. Rama: `feature/<n>-<slug>` desde `dev`."]
    return "\n".join(lines)


def epic_body(epic, children):
    lines = [
        f"**Épica de la {layer_name(epic['layer']).lower()}** · Prioridad: {epic['priority']}",
        "",
        "## Qué entrega", epic["context"],
        "",
        "## Criterio de aceptación",
    ]
    lines += [f"- [ ] {a}" for a in epic["acceptance"]]
    lines += ["", "## Issues de esta épica"]
    lines += [f"- {c['id']}: {c['title']}" for c in children]
    lines += [
        "",
        "## Notas",
        "Una épica no se trabaja directamente: no lleva rama ni PR. Se cierra cuando se cierran sus sub-issues. "
        "Ver \"Épicas\" en `docs/04-GIT-WORKFLOW.md`.",
    ]
    return "\n".join(lines)


def number_from_url(url):
    return int(url.rstrip("/").rsplit("/", 1)[-1])


def load_project(args):
    """Lee del tablero su id, sus campos de selección (Status, Size...) y las URLs ya cargadas."""
    r = run(["gh", "project", "view", str(args.project), "--owner", args.owner, "--format", "json", "--jq", ".id"])
    if r.returncode != 0:
        sys.exit(f"No pude leer el tablero #{args.project} (¿gh auth refresh -s project?): {r.stderr.strip()}")
    project_id = r.stdout.strip()

    r = run(["gh", "project", "field-list", str(args.project), "--owner", args.owner, "--format", "json"])
    if r.returncode != 0:
        sys.exit(f"No pude leer los campos del tablero: {r.stderr.strip()}")
    fields = {f["name"]: {"id": f["id"], "options": {o["name"]: o["id"] for o in f["options"]}}
              for f in json.loads(r.stdout)["fields"] if f.get("options")}
    if "Status" not in fields:
        sys.exit("El tablero no tiene un campo Status")

    r = run(["gh", "project", "item-list", str(args.project), "--owner", args.owner, "--limit", "1000",
             "--format", "json"])
    if r.returncode != 0:
        sys.exit(f"No pude listar los ítems del tablero: {r.stderr.strip()}")
    on_board = {i["content"]["url"] for i in json.loads(r.stdout)["items"] if i.get("content", {}).get("url")}

    return {
        "id": project_id,
        "fields": fields,
        "on_board": on_board,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=DEFAULT_REPO)
    ap.add_argument("--owner", default=DEFAULT_OWNER, help="dueño del Project")
    ap.add_argument("--project", type=int, default=DEFAULT_PROJECT, help="número del Project (0 = no agregar)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    data = json.loads((HERE / "issues.json").read_text(encoding="utf-8"))
    epics, issues = data["epics"], data["issues"]
    by_layer = {}
    for issue in issues:
        by_layer.setdefault(issue["layer"], []).append(issue)
    missing = set(by_layer) - {e["layer"] for e in epics}
    if missing:
        sys.exit(f"Hay issues de capas sin épica en issues.json: {sorted(missing)}")
    known = {i["id"] for i in issues}
    unknown = {b for i in issues for b in i.get("blocked_by", []) if b not in known}
    if unknown:
        sys.exit(f"blocked_by apunta a ids que no existen en issues.json: {sorted(unknown)}")

    existing = {}
    if not args.dry_run:
        r = run(["gh", "issue", "list", "--repo", args.repo, "--state", "all", "--limit", "500", "--json", "title,url"])
        if r.returncode != 0:
            sys.exit(f"No pude listar issues (¿gh auth login?): {r.stderr.strip()}")
        existing = {i["title"]: i["url"] for i in json.loads(r.stdout)}

    board = f"  -> tablero #{args.project}" if args.project else ""
    project = load_project(args) if args.project and not args.dry_run else None

    def add_to_project(url, values):
        """Agrega el issue al tablero y fija sus campos (ej. {"Status": "Backlog", "Size": "M"})."""
        if not project:
            return
        if url in project["on_board"]:
            return
        r = run(["gh", "project", "item-add", str(args.project), "--owner", args.owner, "--url", url,
                 "--format", "json", "--jq", ".id"])
        if r.returncode != 0:
            print(f"  ! no pude agregarlo al tablero -> {r.stderr.strip()}")
            return
        project["on_board"].add(url)
        item_id = r.stdout.strip()
        for field, value in values.items():
            f = project["fields"].get(field)
            option = f and f["options"].get(value)
            if not option:
                print(f"  ! el tablero no tiene {field}={value!r}; queda vacío")
                continue
            r = run(["gh", "project", "item-edit", "--id", item_id, "--project-id", project["id"],
                     "--field-id", f["id"], "--single-select-option-id", option])
            if r.returncode != 0:
                print(f"  ! no pude fijar {field}={value!r} -> {r.stderr.strip()}")

    def ensure(title, body, labels, values):
        """Crea el issue si no existe y lo agrega al tablero. Devuelve su URL (None en dry-run o si falla)."""
        if title in existing:
            print(f"= ya existe: {title}")
            add_to_project(existing[title], values)
            return existing[title]
        if args.dry_run:
            fields = ", ".join(f"{k}: {v}" for k, v in values.items())
            print(f"+ {title}  [{', '.join(labels)}]{board}{f' ({fields})' if board else ''}")
            return None
        cmd = ["gh", "issue", "create", "--repo", args.repo, "--title", title, "--body", body]
        for label in labels:
            cmd += ["--label", label]
        r = run(cmd)
        if r.returncode != 0:
            print(f"! {title}  -> {r.stderr.strip()}")
            return None
        url = r.stdout.strip().splitlines()[-1]
        print(f"+ {title}")
        add_to_project(url, values)
        return url

    def link(epic_url, child_url, child_title, already):
        """Cuelga child como sub-issue de la épica, si no lo estaba."""
        child_number = number_from_url(child_url)
        if child_number in already:
            return
        r = run(["gh", "api", f"repos/{args.repo}/issues/{child_number}", "--jq", ".id"])
        if r.returncode != 0:
            print(f"  ! no pude leer el id de #{child_number} -> {r.stderr.strip()}")
            return
        epic_number = number_from_url(epic_url)
        r = run(["gh", "api", "-X", "POST", f"repos/{args.repo}/issues/{epic_number}/sub_issues",
                 "-F", f"sub_issue_id={r.stdout.strip()}"])
        if r.returncode != 0:
            print(f"  ! no pude colgar {child_title} de la épica #{epic_number} -> {r.stderr.strip()}")

    urls = {}  # id del roadmap (C0-04) -> URL del issue en GitHub
    for epic in sorted(epics, key=lambda e: e["layer"]):
        children = by_layer.get(epic["layer"], [])
        epic_url = ensure(epic_title(epic), epic_body(epic, children), [EPIC_LABEL, layer_label(epic["layer"])],
                         {"Status": EPIC_STATUS})

        already = set()
        if epic_url:
            r = run(["gh", "api", "--paginate", f"repos/{args.repo}/issues/{number_from_url(epic_url)}/sub_issues",
                     "--jq", ".[].number"])
            already = {int(n) for n in r.stdout.split()} if r.returncode == 0 else set()

        for issue in children:
            title = issue_title(issue)
            labels = [layer_label(issue["layer"]), f"area:{issue['area']}", f"tamaño:{issue['size']}"]
            url = ensure(title, issue_body(issue), labels, {"Status": ISSUE_STATUS, "Size": issue["size"]})
            if url:
                urls[issue["id"]] = url
            if args.dry_run:
                print(f"    └ sub-issue de {epic_title(epic)}")
            elif url and epic_url:
                link(epic_url, url, title, already)

    # Dependencias reales de datos: "C1-01 está bloqueado por C0-13".
    db_ids = {}

    def db_id(number):
        if number not in db_ids:
            r = run(["gh", "api", f"repos/{args.repo}/issues/{number}", "--jq", ".id"])
            db_ids[number] = r.stdout.strip() if r.returncode == 0 else None
        return db_ids[number]

    for issue in issues:
        blockers = issue.get("blocked_by", [])
        if not blockers:
            continue
        if args.dry_run:
            print(f"# {issue['id']} bloqueado por {', '.join(blockers)}")
            continue
        if issue["id"] not in urls:
            continue
        number = number_from_url(urls[issue["id"]])
        r = run(["gh", "api", "--paginate", f"repos/{args.repo}/issues/{number}/dependencies/blocked_by",
                 "--jq", ".[].number"])
        current = {int(n) for n in r.stdout.split()} if r.returncode == 0 else set()
        for blocker in blockers:
            if blocker not in urls:
                print(f"  ! {issue['id']}: no encuentro el issue {blocker} para la dependencia")
                continue
            blocker_number = number_from_url(urls[blocker])
            if blocker_number in current:
                continue
            blocker_id = db_id(blocker_number)
            r = run(["gh", "api", "-X", "POST", f"repos/{args.repo}/issues/{number}/dependencies/blocked_by",
                     "-F", f"issue_id={blocker_id}"]) if blocker_id else None
            if not r or r.returncode != 0:
                print(f"  ! no pude marcar {issue['id']} bloqueado por {blocker}"
                      + (f" -> {r.stderr.strip()}" if r else ""))
            else:
                print(f"# {issue['id']} bloqueado por {blocker}")


if __name__ == "__main__":
    main()
