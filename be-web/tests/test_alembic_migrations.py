import ast
from pathlib import Path


VERSIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"
RevisionValue = str | tuple[str, ...] | None


def _required_string_literal(value: ast.expr) -> str:
    match value:
        case ast.Constant(value=str() as revision_value):
            return revision_value
        case _:
            raise AssertionError("Expected a string literal")


def _revision_literal(value: ast.expr | None) -> RevisionValue:
    match value:
        case None:
            raise AssertionError("Expected a revision literal")
        case ast.Constant(value=str() as revision_value):
            return revision_value
        case ast.Constant(value=None):
            return None
        case ast.Tuple(elts=elements):
            return tuple(_required_string_literal(element) for element in elements)
        case _:
            raise AssertionError("Expected a string, tuple, or None revision literal")


def test_alembic_revision_graph_has_single_head() -> None:
    revisions: dict[str, str] = {}
    parent_revisions: set[str] = set()

    for migration_path in VERSIONS_DIR.glob("*.py"):
        tree = ast.parse(migration_path.read_text())
        revision: str | None = None
        down_revision: str | tuple[str, ...] | None = None

        for node in tree.body:
            match node:
                case ast.AnnAssign(target=ast.Name(id=target), value=value) if target in {
                    "revision",
                    "down_revision",
                }:
                    assigned_value = _revision_literal(value)
                case ast.Assign(targets=[ast.Name(id=target)], value=value) if target in {
                    "revision",
                    "down_revision",
                }:
                    assigned_value = _revision_literal(value)
                case _:
                    continue

            match target:
                case "revision":
                    match assigned_value:
                        case str():
                            revision = assigned_value
                        case _:
                            raise AssertionError(f"{migration_path.name} revision must be a string")
                case "down_revision":
                    down_revision = assigned_value
                case _:
                    raise AssertionError(f"Unexpected revision assignment {target}")

        assert revision is not None, f"{migration_path.name} does not define revision"
        revisions[revision] = migration_path.name

        match down_revision:
            case None:
                parent_values: tuple[str, ...] = ()
            case str():
                parent_values = (down_revision,)
            case tuple():
                parent_values = down_revision

        parent_revisions.update(parent_values)

    heads = sorted(set(revisions) - parent_revisions)

    assert len(heads) == 1, f"Expected one Alembic head, found {heads}"
