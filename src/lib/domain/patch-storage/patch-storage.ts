import { z } from 'zod'

import type { PatchDocument } from '#/lib/domain/patch'
import { createMutation, createQuery } from '#/lib/utils'

import type {
  PatchStorageAuthor,
  PatchStorageCompatibility,
  PatchStorageListParams,
  PatchStoragePatchDetail,
  PatchStoragePatchPage,
  PatchStoragePatchSummary,
  PatchStorageProvenance,
  PatchStorageSort,
  PatchStorageTaxonomy,
} from './patch-storage.types'

const PATCH_STORAGE_API_URL = 'https://patchstorage.com/api/beta'
const ZOIA_PLATFORM_ID = 3003
const MAX_BINARY_BYTES = 1_048_576

export const PATCH_STORAGE_PROVENANCE_EXTENSION_KEY =
  'zoia-editor.patchStorage.v1'

const countSchema = z.number().int().nonnegative().catch(0)
const textSchema = z
  .string()
  .nullish()
  .transform((value) => value ?? '')
const taxonomySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
})
const authorSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
})
const artworkSchema = z
  .union([
    z.object({
      id: z.number().int(),
      url: textSchema,
      thumbnail_url: textSchema,
    }),
    z.null(),
    z.literal(false),
  ])
  .transform((value) => (value && typeof value === 'object' ? value : null))

const patchSummarySchema = z.object({
  id: z.number().int(),
  url: textSchema,
  updated_at: z.string(),
  slug: z.string(),
  title: z.string(),
  excerpt: textSchema,
  artwork: artworkSchema.optional().default(null),
  revision: textSchema,
  view_count: countSchema,
  like_count: countSchema,
  download_count: countSchema,
  author: authorSchema,
  tags: z
    .array(taxonomySchema)
    .nullish()
    .transform((value) => value ?? []),
})

const patchFileSchema = z.object({
  id: z.number().int(),
  url: textSchema,
  filesize: countSchema,
  filename: z.string(),
})

const licenseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
  custom_license_text: textSchema,
})

const patchDetailSchema = patchSummarySchema.extend({
  content: textSchema,
  files: z
    .array(patchFileSchema)
    .nullish()
    .transform((value) => value ?? []),
  preview_url: textSchema,
  license: z
    .union([licenseSchema, z.null(), z.literal(false)])
    .optional()
    .transform((value) => (value && typeof value === 'object' ? value : null)),
})

const patchStorageProvenanceSchema = z.object({
  patchId: z.number().int().positive(),
  url: z.string().url(),
  originalTitle: z.string(),
  author: z.object({
    id: z.number().int(),
    name: z.string(),
    slug: z.string(),
  }),
  license: z
    .object({
      id: z.number().int(),
      name: z.string(),
      slug: z.string(),
      customText: z.string(),
    })
    .nullable(),
  importedAt: z.string(),
})

const SORT_PARAMETERS: Record<
  PatchStorageSort,
  { orderby: string; order: 'asc' | 'desc' }
> = {
  newest: { orderby: 'date', order: 'desc' },
  updated: { orderby: 'modified', order: 'desc' },
  downloads: { orderby: 'download_count', order: 'desc' },
  likes: { orderby: 'like_count', order: 'desc' },
  views: { orderby: 'view_count', order: 'desc' },
}

function safeWebUrl(value: string, fallback: string): string {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : fallback
  } catch {
    return fallback
  }
}

function optionalWebUrl(value: string): string | null {
  if (!value) return null
  const safe = safeWebUrl(value, '')
  return safe || null
}

function fallbackDecodeHtml(value: string): string {
  const entities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  }
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[\da-f]+|[a-z]+);/gi, (_match, entity: string) => {
      if (entity.startsWith('#')) {
        const hexadecimal = entity[1].toLowerCase() === 'x'
        const raw = entity.slice(hexadecimal ? 2 : 1)
        const codePoint = Number.parseInt(raw, hexadecimal ? 16 : 10)
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : ''
      }
      return entities[entity.toLowerCase()] ?? `&${entity};`
    })
    .replace(/\s+/g, ' ')
    .trim()
}

function plainText(value: string): string {
  if (!value) return ''
  if (typeof DOMParser === 'undefined') return fallbackDecodeHtml(value)
  const document = new DOMParser().parseFromString(
    value.replace(/<br\s*\/?>/gi, ' ').replace(/<\/p>/gi, ' '),
    'text/html',
  )
  return document.body.textContent.replace(/\s+/g, ' ').trim()
}

function plainTextBlock(value: string): string {
  if (!value) return ''
  if (typeof DOMParser === 'undefined') return fallbackDecodeHtml(value)
  const document = new DOMParser().parseFromString(
    value.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n'),
    'text/html',
  )
  return document.body.textContent
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function mapAuthor(author: z.infer<typeof authorSchema>): PatchStorageAuthor {
  return {
    id: author.id,
    name: plainText(author.name),
    slug: author.slug,
  }
}

function mapTaxonomy(
  taxonomy: z.infer<typeof taxonomySchema>,
): PatchStorageTaxonomy {
  return {
    id: taxonomy.id,
    name: plainText(taxonomy.name),
    slug: taxonomy.slug,
  }
}

function mapSummary(
  patch: z.infer<typeof patchSummarySchema>,
): PatchStoragePatchSummary {
  const fallbackUrl = `https://patchstorage.com/?p=${patch.id}`
  return {
    id: patch.id,
    url: safeWebUrl(patch.url, fallbackUrl),
    updatedAt: patch.updated_at,
    title: plainText(patch.title),
    excerpt: plainText(patch.excerpt),
    artworkUrl: patch.artwork ? optionalWebUrl(patch.artwork.url) : null,
    artworkThumbnailUrl: patch.artwork
      ? optionalWebUrl(patch.artwork.thumbnail_url)
      : null,
    revision: patch.revision,
    viewCount: patch.view_count,
    likeCount: patch.like_count,
    downloadCount: patch.download_count,
    author: mapAuthor(patch.author),
    tags: patch.tags.map(mapTaxonomy),
  }
}

function mapDetail(
  patch: z.infer<typeof patchDetailSchema>,
): PatchStoragePatchDetail {
  return {
    ...mapSummary(patch),
    description: plainTextBlock(patch.content),
    previewUrl: optionalWebUrl(patch.preview_url),
    license: patch.license
      ? {
          id: patch.license.id,
          name: plainText(patch.license.name),
          slug: patch.license.slug,
          customText: plainText(patch.license.custom_license_text),
        }
      : null,
    files: patch.files.map((file) => ({
      id: file.id,
      filename: file.filename,
      filesize: file.filesize,
    })),
  }
}

async function responsePayload(response: Response, fallback: string) {
  if (response.ok) return response.json() as Promise<unknown>
  throw new Error(
    response.status === 429
      ? 'PatchStorage is receiving too many requests. Wait a minute and try again.'
      : response.status >= 500
        ? 'PatchStorage is temporarily unavailable. Try again shortly.'
        : fallback,
  )
}

export const getPatchStoragePatches = createQuery({
  execute: async (
    params: PatchStorageListParams,
    options?: { signal?: AbortSignal },
  ): Promise<PatchStoragePatchPage> => {
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25))
    const page = Math.max(1, params.page)
    const sort = SORT_PARAMETERS[params.sort]
    const query = new URLSearchParams({
      page: String(page),
      per_page: String(pageSize),
      platforms: String(ZOIA_PLATFORM_ID),
      orderby: sort.orderby,
      order: sort.order,
    })
    const search = params.query?.trim()
    if (search) query.set('search', search)

    let response: Response
    try {
      response = await fetch(`${PATCH_STORAGE_API_URL}/patches/?${query}`, {
        signal: options?.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError')
        throw error
      throw new Error(
        'PatchStorage could not be reached. Check your connection and try again.',
      )
    }

    const result = z
      .array(patchSummarySchema)
      .safeParse(
        await responsePayload(response, 'Patches could not be loaded.'),
      )
    if (!result.success)
      throw new Error('PatchStorage returned an unsupported patch listing.')

    const totalItems = Number(response.headers.get('x-wp-total'))
    const totalPages = Number(response.headers.get('x-wp-totalpages'))
    return {
      items: result.data.map(mapSummary),
      page,
      pageSize,
      totalItems: Number.isFinite(totalItems) ? totalItems : result.data.length,
      totalPages: Number.isFinite(totalPages) ? totalPages : 1,
    }
  },
  key: (params: PatchStorageListParams) =>
    [
      'patch-storage',
      'patches',
      {
        page: Math.max(1, params.page),
        pageSize: Math.min(100, Math.max(1, params.pageSize ?? 25)),
        query: params.query?.trim() ?? '',
        sort: params.sort,
      },
    ] as const,
})

export const getPatchStoragePatch = createQuery({
  execute: async (
    patchId: number,
    options?: { signal?: AbortSignal },
  ): Promise<PatchStoragePatchDetail> => {
    let response: Response
    try {
      response = await fetch(`${PATCH_STORAGE_API_URL}/patches/${patchId}/`, {
        signal: options?.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError')
        throw error
      throw new Error(
        'Patch details could not be reached. Check your connection and try again.',
      )
    }
    const result = patchDetailSchema.safeParse(
      await responsePayload(response, 'Patch details could not be loaded.'),
    )
    if (!result.success)
      throw new Error('PatchStorage returned unsupported patch details.')
    return mapDetail(result.data)
  },
  key: (patchId: number) => ['patch-storage', 'patch', { patchId }] as const,
})

export function patchStorageCompatibility(
  patch: PatchStoragePatchDetail,
): PatchStorageCompatibility {
  if (patch.files.length !== 1) {
    return {
      openable: false,
      reason:
        patch.files.length === 0
          ? 'This Patch has no downloadable file.'
          : 'This Patch contains multiple files. Open it on PatchStorage to choose one.',
    }
  }
  const [file] = patch.files
  if (!file.filename.toLowerCase().endsWith('.bin')) {
    return {
      openable: false,
      reason: 'Only direct .bin files can be opened in this release.',
    }
  }
  if (file.filesize > MAX_BINARY_BYTES) {
    return {
      openable: false,
      reason: 'This binary exceeds the 1 MiB Hosted Codec limit.',
    }
  }
  return { openable: true, file }
}

export const downloadPatchStorageBinary = createMutation({
  execute: async (
    patch: PatchStoragePatchDetail,
    options?: { signal?: AbortSignal },
  ): Promise<File> => {
    const compatibility = patchStorageCompatibility(patch)
    if (!compatibility.openable) throw new Error(compatibility.reason)
    const { file } = compatibility
    const response = await fetch(
      `${PATCH_STORAGE_API_URL}/patches/${patch.id}/files/${file.id}/download/`,
      { signal: options?.signal },
    )
    if (!response.ok)
      throw new Error('The PatchStorage binary could not be downloaded.')
    const blob = await response.blob()
    if (blob.size > MAX_BINARY_BYTES)
      throw new Error(
        'The downloaded binary exceeds the 1 MiB Hosted Codec limit.',
      )
    return new File([blob], file.filename, {
      type: 'application/octet-stream',
    })
  },
  key: () => ['patch-storage', 'download'] as const,
})

export function withPatchStorageProvenance(
  document: PatchDocument,
  patch: PatchStoragePatchDetail,
  importedAt = new Date(),
): PatchDocument {
  const provenance: PatchStorageProvenance = {
    patchId: patch.id,
    url: patch.url,
    originalTitle: patch.title,
    author: {
      id: patch.author.id,
      name: patch.author.name,
      slug: patch.author.slug,
    },
    license: patch.license
      ? {
          id: patch.license.id,
          name: patch.license.name,
          slug: patch.license.slug,
          customText: patch.license.customText,
        }
      : null,
    importedAt: importedAt.toISOString(),
  }
  return {
    ...document,
    extensions: {
      ...document.extensions,
      [PATCH_STORAGE_PROVENANCE_EXTENSION_KEY]: provenance,
    },
  }
}

export function patchStorageProvenance(
  document: PatchDocument | null | undefined,
): PatchStorageProvenance | null {
  if (!document) return null
  const result = patchStorageProvenanceSchema.safeParse(
    document.extensions[PATCH_STORAGE_PROVENANCE_EXTENSION_KEY],
  )
  return result.success ? result.data : null
}
