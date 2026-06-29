"""Unit tests for the storage layer — pure I/O, no server."""
import os
import stat

import pytest

import get_secret as gs

SECRET = "sk-unit-do-not-leak-001"


def mode(path) -> int:
    return stat.S_IMODE(os.stat(path).st_mode)


# ---- file: -----------------------------------------------------------------

def test_store_file_writes_value_and_0600(tmp_path):
    p = tmp_path / "k.secret"
    ret = gs.store_file(str(p), SECRET)
    assert ret == str(p)
    assert p.read_text() == SECRET
    assert mode(p) == 0o600


def test_store_file_forces_0600_on_preexisting_loose_file(tmp_path):
    p = tmp_path / "loose.secret"
    p.write_text("old")
    os.chmod(p, 0o644)
    gs.store_file(str(p), SECRET)
    assert mode(p) == 0o600  # O_CREAT mode wouldn't fix this; fchmod does
    assert p.read_text() == SECRET


def test_store_file_refuses_to_follow_symlink(tmp_path):
    target = tmp_path / "target"
    link = tmp_path / "link"
    link.symlink_to(target)
    with pytest.raises(OSError):  # O_NOFOLLOW
        gs.store_file(str(link), SECRET)
    assert not target.exists()  # secret did not land on the link target


# ---- env: ------------------------------------------------------------------

def test_store_env_writes_name_equals_value(tmp_path):
    p = tmp_path / "app.env"
    gs.store_env("API_KEY", str(p), SECRET)
    assert p.read_text() == f"API_KEY={SECRET}\n"
    assert mode(p) == 0o600


def test_store_env_exact_key_dedup_preserves_prefix_overlap(tmp_path):
    p = tmp_path / "app.env"
    p.write_text("API_KEY=keep-me\nAPI=replace-me\nOTHER=untouched\n")
    gs.store_env("API", str(p), "new")
    lines = p.read_text().splitlines()
    assert "API_KEY=keep-me" in lines  # prefix match would have nuked this
    assert "OTHER=untouched" in lines
    assert "API=new" in lines
    assert "API=replace-me" not in lines


def test_store_env_retrieve_hint_uses_real_name(tmp_path):
    ret = gs.store_env("OPENAI_API_KEY", str(tmp_path / "x.env"), SECRET)
    assert "${OPENAI_API_KEY}" in ret  # regression: was a literal ${name}
    assert "${name}" not in ret


@pytest.mark.parametrize("bad", ["val\nINJECTED=1", "val\rINJECTED=1", "a\nb"])
def test_store_env_rejects_newline_values(tmp_path, bad):
    p = tmp_path / "app.env"
    with pytest.raises(ValueError, match="newline"):
        gs.store_env("API_KEY", str(p), bad)
    assert not p.exists()  # nothing written on rejection


@pytest.mark.parametrize("bad", ["1abc", "a-b", "a b", "", "a.b", "FOO=BAR"])
def test_store_env_rejects_invalid_names(tmp_path, bad):
    with pytest.raises(ValueError, match="invalid variable name"):
        gs.store_env(bad, str(tmp_path / "x.env"), SECRET)


@pytest.mark.parametrize("ok", ["A", "_x", "API_KEY", "lower9"])
def test_store_env_accepts_valid_names(tmp_path, ok):
    gs.store_env(ok, str(tmp_path / "x.env"), SECRET)  # no raise


# ---- keychain (argv only — never touches the real keychain) ----------------

def test_store_keychain_builds_security_argv(monkeypatch):
    calls = {}

    def fake_run(argv, **kw):
        calls["argv"] = argv
        calls["kw"] = kw

        class R:  # noqa: D401
            pass
        return R()

    monkeypatch.setattr(gs.subprocess, "run", fake_run)
    monkeypatch.setattr(gs.getpass, "getuser", lambda: "tester")
    ret = gs.store_keychain("API_KEY", "my-service", SECRET)

    assert calls["argv"][:3] == ["security", "add-generic-password", "-U"]
    assert "-s" in calls["argv"] and "my-service" in calls["argv"]
    assert "-a" in calls["argv"] and "tester" in calls["argv"]
    assert calls["kw"].get("check") is True
    assert calls["kw"].get("capture_output") is True
    assert ret == "security find-generic-password -s my-service -a tester -w"


# ---- dispatch routing ------------------------------------------------------

def test_dispatch_file(tmp_path):
    p = tmp_path / "d.secret"
    label, ret = gs.dispatch_store("N", f"file:{p}", SECRET)
    assert label == f"file:{p}"
    assert ret == str(p)
    assert p.read_text() == SECRET


def test_dispatch_env(tmp_path):
    p = tmp_path / "d.env"
    label, ret = gs.dispatch_store("API_KEY", f"env:{p}", SECRET)
    assert label == f"env:{p}"
    assert "source" in ret


@pytest.mark.parametrize("dest,expected_service", [
    ("keychain", "DEFAULT_NAME"),
    ("keychain:custom-svc", "custom-svc"),
])
def test_dispatch_keychain_service_resolution(monkeypatch, dest, expected_service):
    seen = {}
    monkeypatch.setattr(gs, "store_keychain",
                        lambda name, service, value: seen.setdefault("svc", service) or "hint")
    label, _ = gs.dispatch_store("DEFAULT_NAME", dest, SECRET)
    assert seen["svc"] == expected_service
    assert label == f"keychain:{expected_service}"


def test_dispatch_unknown_dest_raises():
    with pytest.raises(ValueError, match="unknown --dest"):
        gs.dispatch_store("N", "s3://bucket", SECRET)


# ---- exit-code contract ----------------------------------------------------

@pytest.mark.parametrize("result,code", [
    ({"stored": True, "retrieve": "x"}, 0),
    ({"error": "boom"}, 3),
    ({}, 2),
    ({"stored": True, "error": "ignored"}, 0),  # stored wins
])
def test_exit_code(result, code):
    assert gs.exit_code(result) == code
