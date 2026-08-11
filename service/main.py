import base64
import json

from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
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

app = FastAPI(title="ZOIA Patch Parser", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ready"}


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
        return parse_patch(await file.read(), file.filename or "patch.bin")
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
            await file.read(),
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
