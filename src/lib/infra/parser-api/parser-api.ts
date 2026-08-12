const PARSER_API_URL = import.meta.env.VITE_PARSER_API_URL ?? ''

export class ParserApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParserApiError'
  }
}

export type ImportedParameterEditDto = {
  moduleId: number
  parameterName: string
  rawValue: number
}

export type PatchDraftDto = {
  name: string
  modules: readonly {
    id: string
    catalogId: string
    name: string
    rawParameters: Readonly<Record<string, number>>
  }[]
  connections: readonly {
    id: string
    sourceModuleId: string
    targetModuleId: string
  }[]
}

async function responseError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as {
    detail?: string
  } | null
  return new ParserApiError(payload?.detail ?? fallback)
}

export async function fetchModuleCatalog(options?: {
  signal?: AbortSignal
}): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${PARSER_API_URL}/api/modules/catalog`, {
      signal: options?.signal,
    })
  } catch {
    throw new ParserApiError(
      'The Hosted Codec is unavailable. Patch Document authoring remains available.',
    )
  }
  if (!response.ok) {
    throw await responseError(response, 'The Module catalog could not be loaded.')
  }
  return response.json()
}

export async function resolveExperimentalModuleConfiguration(input: {
  moduleIndex: number
  optionIndices: Record<string, number>
}): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(
      `${PARSER_API_URL}/api/modules/experimental-configuration`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    )
  } catch {
    throw new ParserApiError(
      'The Hosted Codec is unavailable, so this Experimental Module configuration cannot be resolved.',
    )
  }
  if (!response.ok)
    throw await responseError(
      response,
      'The Experimental Module configuration could not be resolved.',
    )
  return response.json()
}

export async function uploadPatchBinary(
  file: File,
  options?: { signal?: AbortSignal },
): Promise<unknown> {
  const body = new FormData()
  body.append('file', file)

  let response: Response
  try {
    response = await fetch(`${PARSER_API_URL}/api/patches/parse`, {
      method: 'POST',
      body,
      signal: options?.signal,
    })
  } catch {
    throw new ParserApiError(
      'The Hosted Codec is unavailable. You can still open and edit .zoia.json Patch Documents.',
    )
  }

  if (!response.ok) {
    throw await responseError(
      response,
      'The patch could not be parsed. Try another .bin file.',
    )
  }

  return response.json()
}

export async function compileImportedPatchBinary(
  file: File,
  draftRevision: number,
  parameterEdits: readonly ImportedParameterEditDto[],
  options?: { signal?: AbortSignal },
): Promise<unknown> {
  const body = new FormData()
  body.append('file', file)
  body.append('draft_revision', String(draftRevision))
  body.append('parameter_edits', JSON.stringify(parameterEdits))

  let response: Response
  try {
    response = await fetch(`${PARSER_API_URL}/api/patches/compile-imported`, {
      method: 'POST',
      body,
      signal: options?.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ParserApiError(
      'The Hosted Codec is unavailable. Save a Patch Version now and retry binary export later.',
    )
  }

  if (!response.ok) {
    throw await responseError(response, 'The Patch could not be compiled. Try again.')
  }

  return response.json()
}

export async function compilePatchDocumentBinary(
  document: unknown,
  patchRevision: number,
  options?: { signal?: AbortSignal },
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${PARSER_API_URL}/api/patches/compile-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document, patchRevision }),
      signal: options?.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ParserApiError(
      'The Hosted Codec is unavailable. Your Patch Document remains editable and saveable.',
    )
  }
  if (!response.ok) {
    throw await responseError(response, 'The Patch Document could not be compiled.')
  }
  return response.json()
}

export async function compilePatchDraftBinary(
  draft: PatchDraftDto,
  draftRevision: number,
  options?: { signal?: AbortSignal },
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${PARSER_API_URL}/api/patches/compile-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, draftRevision }),
      signal: options?.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ParserApiError(
      'The Hosted Codec is unavailable. Save a Patch Version now and retry binary export later.',
    )
  }
  if (!response.ok) {
    throw await responseError(response, 'The Patch Draft could not be compiled.')
  }
  return response.json()
}
