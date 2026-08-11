import type { PatchDocument } from './patch-document'

export const ZOIA_MODULE_COLORS = [
  { id: 1, name: 'Blue', hex: '#0000ff' },
  { id: 2, name: 'Green', hex: '#00ff00' },
  { id: 3, name: 'Red', hex: '#ff0000' },
  { id: 4, name: 'Yellow', hex: '#ffff00' },
  { id: 5, name: 'Aqua', hex: '#00ffff' },
  { id: 6, name: 'Magenta', hex: '#ff00ff' },
  { id: 7, name: 'White', hex: '#ffffff' },
  { id: 8, name: 'Orange', hex: '#ffa500' },
  { id: 9, name: 'Lima', hex: '#bfff00' },
  { id: 10, name: 'Surf', hex: '#3627f6' },
  { id: 11, name: 'Sky', hex: '#87ceeb' },
  { id: 12, name: 'Purple', hex: '#a020f0' },
  { id: 13, name: 'Pink', hex: '#ff007f' },
  { id: 14, name: 'Peach', hex: '#ffe5b4' },
  { id: 15, name: 'Mango', hex: '#ff8243' },
] as const

export type ZoiaModuleColorId = (typeof ZOIA_MODULE_COLORS)[number]['id']

export const DEFAULT_ZOIA_MODULE_COLOR_ID: ZoiaModuleColorId = 2

export function isZoiaModuleColorId(
  value: unknown,
): value is ZoiaModuleColorId {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 15
  )
}

export function patchDocumentModuleColorId(
  document: PatchDocument,
  moduleId: string,
): ZoiaModuleColorId {
  const index = document.modules.findIndex((module) => module.id === moduleId)
  if (index < 0) return DEFAULT_ZOIA_MODULE_COLOR_ID
  const module = document.modules[index]
  const colorId = module.hardware?.headerColorId ?? document.colors[index]
  return isZoiaModuleColorId(colorId) ? colorId : DEFAULT_ZOIA_MODULE_COLOR_ID
}

export function setPatchDocumentModuleColor(
  document: PatchDocument,
  moduleId: string,
  colorId: ZoiaModuleColorId,
): PatchDocument {
  const index = document.modules.findIndex((module) => module.id === moduleId)
  if (index < 0 || patchDocumentModuleColorId(document, moduleId) === colorId)
    return document

  const colors = [...document.colors]
  while (colors.length < document.modules.length)
    colors.push(DEFAULT_ZOIA_MODULE_COLOR_ID)
  colors[index] = colorId

  return {
    ...document,
    colors,
    modules: document.modules.map((module) =>
      module.id === moduleId && module.hardware
        ? {
            ...module,
            hardware: { ...module.hardware, headerColorId: colorId },
          }
        : module,
    ),
  }
}
