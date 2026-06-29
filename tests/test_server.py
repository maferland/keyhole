"""Integration tests — drive the request handler in-process on a random port.

No curl, no sed-scraped tokens, no fixed ports, no sleep-polling. A raw socket
gives full control over Host / Origin / Content-Length so each HTTP guard can
be exercised deterministically.
"""
import socket

import pytest

import get_secret as gs

SECRET = "topsecret-do-not-leak-xyz"


@pytest.fixture
def session(tmp_path):
    """A live capture bound to a random port, storing to a file in tmp_path."""
    s = gs.CaptureSession("API_KEY", f"file:{tmp_path / 'out.secret'}", port=0)
    s.serve_background()
    s.dest_path = tmp_path / "out.secret"  # convenience for assertions
    yield s
    s.close()


def http(port, method, path, *, host=None, origin=None, body=None, send_length=True):
    """Send one HTTP/1.0 request and return (status_code, full_response_bytes).

    HTTP/1.0 with no keep-alive makes the server close the socket after the
    response, so the read loop terminates cleanly.
    """
    if host is None:
        host = f"127.0.0.1:{port}"
    lines = [f"{method} {path} HTTP/1.0", f"Host: {host}"]
    if origin:
        lines.append(f"Origin: {origin}")
    if body is not None:
        lines.append("Content-Type: application/x-www-form-urlencoded")
        if send_length:
            lines.append(f"Content-Length: {len(body)}")
    raw = ("\r\n".join(lines) + "\r\n\r\n" + (body or "")).encode()

    sock = socket.create_connection(("127.0.0.1", port), timeout=5)
    sock.sendall(raw)
    chunks = []
    while True:
        b = sock.recv(4096)
        if not b:
            break
        chunks.append(b)
    sock.close()
    data = b"".join(chunks)
    status = int(data.split(b" ", 2)[1])
    return status, data


def submit(session, value=SECRET, **kw):
    return http(session.port, "POST", session.token + "/submit",
                body=f"secret={value}", **kw)


# ---- GET form --------------------------------------------------------------

def test_get_form_served_at_token(session):
    status, data = http(session.port, "GET", session.token)
    assert status == 200
    assert b"Provide a secret" in data
    assert b"API_KEY" in data                       # the name pill
    assert (session.token + "/submit").encode() in data  # form posts back to us


def test_get_token_is_exact_not_prefix(session):
    # /TOKENanything must NOT serve the page (token would otherwise leak via path)
    assert http(session.port, "GET", session.token + "evil")[0] == 404
    assert http(session.port, "GET", "/")[0] == 404


# ---- POST guards -----------------------------------------------------------

def test_post_wrong_path_404(session):
    assert http(session.port, "POST", "/nope")[0] == 404


def test_post_rejects_foreign_host_rebinding(session):
    status, _ = submit(session, host="evil.example:1234")
    assert status == 403
    assert not session.done.is_set()


def test_post_rejects_foreign_origin(session):
    status, _ = submit(session, origin="http://evil.example")
    assert status == 403


def test_post_accepts_localhost_alias(session):
    status, _ = submit(session, host=f"localhost:{session.port}",
                       origin=f"http://localhost:{session.port}")
    assert status == 200


def test_post_missing_content_length_411(session):
    status, _ = http(session.port, "POST", session.token + "/submit",
                     body="secret=x", send_length=False)
    assert status == 411
    assert not session.done.is_set()


def test_post_empty_value_400(session):
    status, _ = http(session.port, "POST", session.token + "/submit", body="secret=")
    assert status == 400


# ---- POST success / single-use --------------------------------------------

def test_post_success_stores_and_sets_done(session):
    status, _ = submit(session)
    assert status == 200
    assert session.done.is_set()
    assert session.dest_path.read_text() == SECRET
    assert session.result["stored"] is True
    assert session.result["dest"] == f"file:{session.dest_path}"


def test_success_result_never_contains_the_value(session):
    submit(session)
    import json
    blob = json.dumps(session.result)
    assert SECRET not in blob  # what main() prints to stdout must not leak


def test_single_use_second_submit_409(session):
    assert submit(session)[0] == 200
    status, body = submit(session, value="second-attempt")
    assert status == 409
    assert b"already stored" in body
    assert session.dest_path.read_text() == SECRET  # not overwritten


# ---- store failure ---------------------------------------------------------

def test_store_failure_returns_500_and_sets_done(tmp_path):
    # symlink dest → O_NOFOLLOW raises OSError → generic failure path
    link = tmp_path / "link"
    link.symlink_to(tmp_path / "target")
    s = gs.CaptureSession("API_KEY", f"file:{link}", port=0)
    s.serve_background()
    try:
        status, body = submit(s)
        assert status == 500
        assert body.split(b"\r\n\r\n", 1)[-1] == b"store error"  # generic, no detail
        assert s.done.is_set()
        assert "error" in s.result
        assert SECRET not in s.result["error"]  # failure must not echo the value
        assert gs.exit_code(s.result) == 3
    finally:
        s.close()


def test_validation_failure_400_allows_retry(tmp_path):
    # env: newline → ValueError → 400, done NOT set, user can resubmit
    s = gs.CaptureSession("API_KEY", f"env:{tmp_path / 'a.env'}", port=0)
    s.serve_background()
    try:
        status, _ = submit(s, value="line1\nINJECTED=1")
        assert status == 400
        assert not s.done.is_set()  # still open for a corrected submit
        assert submit(s, value="clean-value")[0] == 200
    finally:
        s.close()
