import base64
import zipfile
from pathlib import Path

from fastapi.testclient import TestClient

from service.main import app
from service.parser_adapter import parse_patch

ROOT = Path(__file__).resolve().parents[2]
FIXTURE_ARCHIVE = (
    ROOT
    / ".vendor"
    / "zoia_lib"
    / "zoia_lib"
    / "tests"
    / "sample_files"
    / "sampleZIPBytes.bin"
)


def test_health_identifies_the_pinned_codec_revision():
    for path in ("/health", "/api/health"):
        response = TestClient(app).get(path)

        assert response.status_code == 200
        assert response.json() == {
            "status": "ready",
            "zoiaLibRevision": "9a959c4ef2ecbaa82f6525761472058bbead7d66",
        }


def test_rejects_oversized_binary_before_parsing():
    response = TestClient(app).post(
        "/api/patches/parse",
        files={"file": ("too-large.bin", b"x" * (1_048_576 + 1), "application/octet-stream")},
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "The binary exceeds the 1 MiB limit."


def test_compile_imported_endpoint_returns_conformant_binary():
    with zipfile.ZipFile(FIXTURE_ARCHIVE) as archive:
        archived_name = next(name for name in archive.namelist() if name.endswith(".bin"))
        filename = Path(archived_name).name
        source = archive.read(archived_name)

    response = TestClient(app).post(
        "/api/patches/compile-imported",
        files={"file": (filename, source, "application/octet-stream")},
        data={
            "draft_revision": "7",
            "parameter_edits": '[{"moduleId":0,"parameterName":"value","rawValue":20000}]',
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["draftRevision"] == 7
    assert payload["findings"] == []
    assert payload["conformance"]["changedParameterCount"] == 1
    binary = base64.b64decode(payload["binaryBase64"])
    assert parse_patch(binary, payload["outputFilename"])["modules"][0]["parameters"][0][
        "rawValue"
    ] == 20_000


def test_compile_document_endpoint_returns_exact_unchanged_binary():
    with zipfile.ZipFile(FIXTURE_ARCHIVE) as archive:
        archived_name = next(name for name in archive.namelist() if name.endswith(".bin"))
        filename = Path(archived_name).name
        source = archive.read(archived_name)
    document = parse_patch(source, filename)

    response = TestClient(app).post(
        "/api/patches/compile-document",
        json={"patchRevision": 11, "document": document},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["draftRevision"] == 11
    assert base64.b64decode(payload["binaryBase64"]) == source


def test_module_catalog_exposes_insertable_mono_configurations():
    response = TestClient(app).get("/api/modules/catalog")

    assert response.status_code == 200
    modules = response.json()["modules"]
    assert {
        "vca",
        "filter",
        "compressor",
        "distortion",
        "delay",
        "reverb",
        "mixer",
        "looper-8s-once",
        "midi-clock-in",
        "clock-divider",
        "midi-cc-20",
        "midi-notes-loop-trigger",
        "audio-balance-stereo",
    } <= {module["id"] for module in modules}
    assert all("parameters" in module for module in modules)


def test_compile_draft_endpoint_returns_experimental_binary():
    response = TestClient(app).post(
        "/api/patches/compile-draft",
        json={
            "draftRevision": 5,
            "name": "Scratch",
            "modules": [
                {
                    "id": "input",
                    "catalogId": "audio-input-mono",
                    "name": "Input",
                    "rawParameters": {},
                },
                {
                    "id": "output",
                    "catalogId": "audio-output-mono",
                    "name": "Output",
                    "rawParameters": {},
                },
            ],
            "connections": [
                {
                    "id": "input-output",
                    "sourceModuleId": "input",
                    "targetModuleId": "output",
                }
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["draftRevision"] == 5
    assert [finding["code"] for finding in payload["findings"]] == [
        "hardware_unverified"
    ]
    binary = base64.b64decode(payload["binaryBase64"])
    parsed = parse_patch(binary, payload["outputFilename"])
    assert parsed["name"] == "Scratch"
    assert len(parsed["modules"]) == 2
    assert len(parsed["connections"]) == 1
