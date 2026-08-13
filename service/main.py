import asyncio
import base64
import json
import os
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from fastapi import Body, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from service.module_catalog import catalog_payload
from service.parser_adapter import InvalidPatchError, ParserUnavailableError, parse_patch
from service.patch_compiler import (
    CompileImportedPatchRequest,
    CompilePatchDraftRequest,
    CompilerUnavailableError,
    DraftConnection,
    DraftModule,
    ParameterEdit,
    compile_imported_patch,
    compile_patch_document,
    compile_patch_draft,
    resolve_experimental_configuration,
)

MAX_BINARY_BYTES = int(os.environ.get("CODEC_MAX_BINARY_BYTES", 1_048_576))
MAX_JSON_BYTES = int(os.environ.get("CODEC_MAX_JSON_BYTES", 5_242_880))
REQUEST_TIMEOUT_SECONDS = float(os.environ.get("CODEC_REQUEST_TIMEOUT_SECONDS", 15))
RATE_LIMIT_PER_MINUTE = int(os.environ.get("CODEC_RATE_LIMIT_PER_MINUTE", 30))
MAX_CONCURRENCY = int(os.environ.get("CODEC_MAX_CONCURRENCY", 2))
ZOIA_LIB_REVISION = os.environ.get(
    "ZOIA_LIB_REVISION", "9a959c4ef2ecbaa82f6525761472058bbead7d66"
)

_request_slots = asyncio.Semaphore(MAX_CONCURRENCY)
_request_times: defaultdict[str, deque[float]] = defaultdict(deque)
_rate_lock = asyncio.Lock()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


app = FastAPI(
    title="ZOIA Hosted Codec",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def _client_address(request: Request) -> str:
    return (
        request.headers.get("cf-connecting-ip")
        or request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
        or (request.client.host if request.client else "unknown")
    )


async def _within_rate_limit(client: str) -> bool:
    now = time.monotonic()
    async with _rate_lock:
        requests = _request_times[client]
        while requests and requests[0] <= now - 60:
            requests.popleft()
        if len(requests) >= RATE_LIMIT_PER_MINUTE:
            return False
        requests.append(now)
        return True


@app.middleware("http")
async def protect_public_codec(request: Request, call_next):
    if not request.url.path.startswith("/api/"):
        return await call_next(request)
    maximum = (
        MAX_BINARY_BYTES + 65_536
        if request.url.path in {"/api/patches/parse", "/api/patches/compile-imported"}
        else MAX_JSON_BYTES
    )
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > maximum:
                return JSONResponse(status_code=413, content={"detail": "The request is too large."})
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": "The Content-Length header is invalid."})
    body = await request.body()
    if len(body) > maximum:
        return JSONResponse(status_code=413, content={"detail": "The request is too large."})
    if not await _within_rate_limit(_client_address(request)):
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": "60"},
            content={"detail": "Too many codec requests. Try again in one minute."},
        )
    try:
        async with _request_slots:
            return await asyncio.wait_for(call_next(request), timeout=REQUEST_TIMEOUT_SECONDS)
    except TimeoutError:
        return JSONResponse(
            status_code=504,
            content={"detail": "The codec operation exceeded its time limit."},
        )


async def _read_binary(file: UploadFile) -> bytes:
    data = await file.read(MAX_BINARY_BYTES + 1)
    if len(data) > MAX_BINARY_BYTES:
        raise HTTPException(status_code=413, detail="The binary exceeds the 1 MiB limit.")
    return data


@app.get("/health")
@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ready", "zoiaLibRevision": ZOIA_LIB_REVISION}


@app.get("/api/modules/catalog")
def get_module_catalog() -> dict:
    return {"modules": catalog_payload()}


@app.post("/api/modules/experimental-configuration")
def resolve_experimental_module_configuration(payload: dict = Body(...)) -> dict:
    try:
        return resolve_experimental_configuration(
            int(payload.get("moduleIndex")),
            {str(key): int(value) for key, value in payload.get("optionIndices", {}).items()},
        )
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/api/patches/parse")
async def parse_patch_file(file: UploadFile = File(...)) -> dict:
    try:
        return parse_patch(await _read_binary(file), file.filename or "patch.bin")
    except InvalidPatchError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except ParserUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.post("/api/patches/compile-imported")
async def compile_imported_patch_file(
    file: UploadFile = File(...),
    draft_revision: int = Form(...),
    parameter_edits: str = Form("[]"),
) -> dict:
    try:
        edit_payload = json.loads(parameter_edits)
        if not isinstance(edit_payload, list):
            raise ValueError("parameter_edits must be a JSON array")
        edits = tuple(
            ParameterEdit(
                module_id=int(item["moduleId"]),
                parameter_name=str(item["parameterName"]),
                raw_value=int(item["rawValue"]),
            )
            for item in edit_payload
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=422,
            detail="Parameter Edits must be a valid JSON array.",
        ) from error

    try:
        result = compile_imported_patch(
            await _read_binary(file),
            CompileImportedPatchRequest(
                draft_revision=draft_revision,
                source_filename=file.filename or "patch.bin",
                parameter_edits=edits,
            ),
        )
    except CompilerUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    return _compilation_response(result)


def _compilation_response(result) -> dict:
    return {
        "draftRevision": result.draft_revision,
        "outputFilename": result.output_filename,
        "binaryBase64": (
            base64.b64encode(result.binary).decode("ascii")
            if result.binary is not None
            else None
        ),
        "findings": [
            {
                "severity": finding.severity,
                "code": finding.code,
                "message": finding.message,
                "moduleId": finding.module_id,
                "parameterName": finding.parameter_name,
            }
            for finding in result.findings
        ],
        "conformance": {
            "unchangedFieldsPreserved": (
                result.conformance.unchanged_fields_preserved
            ),
            "changedParameterCount": result.conformance.changed_parameter_count,
        },
    }


@app.post("/api/patches/compile-document")
def compile_patch_document_payload(payload: dict = Body(...)) -> dict:
    document = payload.get("document")
    if (
        not isinstance(document, dict)
        or document.get("format") != "zoia-patch"
        or document.get("schemaVersion") != 1
    ):
        raise HTTPException(status_code=422, detail="The Patch Document payload is invalid.")
    try:
        revision = int(payload["patchRevision"])
        return _compilation_response(compile_patch_document(document, revision))
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail="The Patch Revision is invalid.") from error
    except CompilerUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.post("/api/patches/compile-draft")
def compile_patch_draft_payload(payload: dict = Body(...)) -> dict:
    try:
        modules_payload = payload["modules"]
        connections_payload = payload["connections"]
        if not isinstance(modules_payload, list) or not isinstance(connections_payload, list):
            raise ValueError("modules and connections must be arrays")
        request = CompilePatchDraftRequest(
            draft_revision=int(payload["draftRevision"]),
            name=str(payload["name"]),
            modules=tuple(
                DraftModule(
                    id=str(module["id"]),
                    catalog_id=str(module["catalogId"]),
                    name=str(module["name"]),
                    raw_parameters={
                        str(key): int(value)
                        for key, value in module["rawParameters"].items()
                    },
                )
                for module in modules_payload
            ),
            connections=tuple(
                DraftConnection(
                    id=str(connection["id"]),
                    source_module_id=str(connection["sourceModuleId"]),
                    target_module_id=str(connection["targetModuleId"]),
                )
                for connection in connections_payload
            ),
        )
    except (AttributeError, KeyError, TypeError, ValueError) as error:
        raise HTTPException(
            status_code=422,
            detail="The Patch Draft payload is invalid.",
        ) from error

    try:
        return _compilation_response(compile_patch_draft(request))
    except CompilerUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
