export const PATCH_STORAGE_SORTS = [
  'newest',
  'updated',
  'downloads',
  'likes',
  'views',
] as const

export type PatchStorageSort = (typeof PATCH_STORAGE_SORTS)[number]
export type PatchStorageAuthor = {
  id: number
  name: string
  slug: string
}
export type PatchStorageTaxonomy = {
  id: number
  name: string
  slug: string
}
export type PatchStoragePatchSummary = {
  id: number
  url: string
  updatedAt: string
  title: string
  excerpt: string
  artworkUrl: string | null
  artworkThumbnailUrl: string | null
  revision: string
  viewCount: number
  likeCount: number
  downloadCount: number
  author: PatchStorageAuthor
  tags: PatchStorageTaxonomy[]
}
export type PatchStoragePatchFile = {
  id: number
  filename: string
  filesize: number
}
export type PatchStorageLicense = {
  id: number
  name: string
  slug: string
  customText: string
}
export type PatchStoragePatchDetail = PatchStoragePatchSummary & {
  description: string
  previewUrl: string | null
  license: PatchStorageLicense | null
  files: PatchStoragePatchFile[]
}
export type PatchStoragePatchPage = {
  items: PatchStoragePatchSummary[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}
export type PatchStorageListParams = {
  query?: string
  page: number
  pageSize?: number
  sort: PatchStorageSort
}
export type PatchStorageProvenance = {
  patchId: number
  url: string
  originalTitle: string
  author: {
    id: number
    name: string
    slug: string
  }
  license: {
    id: number
    name: string
    slug: string
    customText: string
  } | null
  importedAt: string
}
export type PatchStorageCompatibility =
  | { openable: true; file: PatchStoragePatchFile }
  | { openable: false; reason: string }
