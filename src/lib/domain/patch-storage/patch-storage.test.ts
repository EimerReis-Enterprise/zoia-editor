import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createAdvancedPatchDocument,
  getModuleCatalog,
} from '#/lib/domain/patch'

import {
  downloadPatchStorageBinary,
  getPatchStoragePatch,
  getPatchStoragePatches,
  patchStorageCompatibility,
  patchStorageProvenance,
  withPatchStorageProvenance,
} from './patch-storage'
import type { PatchStoragePatchDetail } from './patch-storage.types'

const summaryPayload = {
  id: 106557,
  url: 'https://patchstorage.com/alterneath/',
  updated_at: '2020-05-13T11:31:32+00:00',
  slug: 'alterneath',
  title: 'Alterneath &amp; Beyond',
  excerpt: '<p>A smeared delay.<br>Built for ZOIA.</p>',
  artwork: false,
  revision: '5',
  view_count: 10_618,
  like_count: 173,
  download_count: 9_352,
  author: {
    id: 42,
    name: 'Patch Author',
    slug: 'patch-author',
  },
  tags: [{ id: 123, name: 'Reverb', slug: 'reverb' }],
}

const detailPayload = {
  ...summaryPayload,
  content: '<p>Full patch notes &amp; routing details.</p>',
  preview_url: 'https://example.com/preview',
  files: [
    {
      id: 124057,
      filename: '111_zoia_ALTERNEATH_V5.bin',
      filesize: 32_768,
      url: 'https://patchstorage.com/api/beta/patches/106557/files/124057/download/',
    },
  ],
  license: {
    id: 4191,
    name: 'Creative Commons Attribution Share Alike 4.0',
    slug: 'cc-by-sa-4-0',
    custom_license_text: '',
  },
}

afterEach(() => vi.unstubAllGlobals())

describe('PatchStorage queries', () => {
  it('requests a paginated ZOIA collection with server-side popularity sorting', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([summaryPayload]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-wp-total': '1513',
          'x-wp-totalpages': '61',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await getPatchStoragePatches({
      page: 2,
      pageSize: 25,
      query: ' ambient ',
      sort: 'downloads',
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.origin + url.pathname).toBe(
      'https://patchstorage.com/api/beta/patches/',
    )
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      page: '2',
      per_page: '25',
      platforms: '3003',
      search: 'ambient',
      orderby: 'download_count',
      order: 'desc',
    })
    expect(result).toMatchObject({
      page: 2,
      pageSize: 25,
      totalItems: 1513,
      totalPages: 61,
    })
    expect(result.items[0]).toMatchObject({
      title: 'Alterneath & Beyond',
      excerpt: 'A smeared delay. Built for ZOIA.',
      downloadCount: 9_352,
    })
  })

  it('maps full Patch details and accepts exactly one direct binary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(detailPayload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    const patch = await getPatchStoragePatch(106557)

    expect(patch.description).toBe('Full patch notes & routing details.')
    expect(patch.license?.slug).toBe('cc-by-sa-4-0')
    expect(patchStorageCompatibility(patch)).toEqual({
      openable: true,
      file: {
        id: 124057,
        filename: '111_zoia_ALTERNEATH_V5.bin',
        filesize: 32_768,
      },
    })
  })

  it('rejects ZIP and multiple-file entries from Workbench import', () => {
    const patch = {
      files: [{ id: 1, filename: 'patch.zip', filesize: 100 }],
    } as PatchStoragePatchDetail
    expect(patchStorageCompatibility(patch)).toMatchObject({
      openable: false,
      reason: 'Only direct .bin files can be opened in this release.',
    })

    expect(
      patchStorageCompatibility({
        ...patch,
        files: [
          { id: 1, filename: 'a.bin', filesize: 32_768 },
          { id: 2, filename: 'b.bin', filesize: 32_768 },
        ],
      }),
    ).toMatchObject({ openable: false })
  })

  it('downloads through the stable PatchStorage file endpoint', async () => {
    const patch = {
      id: 106557,
      files: [
        {
          id: 124057,
          filename: '111_zoia_ALTERNEATH_V5.bin',
          filesize: 3,
        },
      ],
    } as PatchStoragePatchDetail
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const file = await downloadPatchStorageBinary(patch)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://patchstorage.com/api/beta/patches/106557/files/124057/download/',
      { signal: undefined },
    )
    expect(file.name).toBe('111_zoia_ALTERNEATH_V5.bin')
    expect(file.size).toBe(3)
  })

  it('retains portable Patch Provenance without engagement counts', async () => {
    const patch = {
      id: 106557,
      url: 'https://patchstorage.com/alterneath/',
      title: 'Alterneath',
      author: { id: 42, name: 'Patch Author', slug: 'patch-author' },
      license: {
        id: 4191,
        name: 'CC BY-SA 4.0',
        slug: 'cc-by-sa-4-0',
        customText: '',
      },
    } as PatchStoragePatchDetail
    const document = createAdvancedPatchDocument(
      'Imported',
      await getModuleCatalog(),
    )

    const imported = withPatchStorageProvenance(
      document,
      patch,
      new Date('2026-08-13T12:00:00.000Z'),
    )

    expect(patchStorageProvenance(imported)).toEqual({
      patchId: 106557,
      url: 'https://patchstorage.com/alterneath/',
      originalTitle: 'Alterneath',
      author: { id: 42, name: 'Patch Author', slug: 'patch-author' },
      license: {
        id: 4191,
        name: 'CC BY-SA 4.0',
        slug: 'cc-by-sa-4-0',
        customText: '',
      },
      importedAt: '2026-08-13T12:00:00.000Z',
    })
    expect(JSON.stringify(imported.extensions)).not.toContain('downloadCount')
  })
})
