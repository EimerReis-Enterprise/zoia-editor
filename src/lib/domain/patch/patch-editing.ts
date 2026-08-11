import type { PatchProjection } from './patch'

export type ParameterEdit = {
  moduleId: number
  parameterName: string
  rawValue: number
}

export function parameterEditId(edit: Pick<ParameterEdit, 'moduleId' | 'parameterName'>) {
  return `${edit.moduleId}:${edit.parameterName}`
}

export function rawParameterValue(
  patch: PatchProjection,
  moduleId: number,
  parameterName: string,
  edits: readonly ParameterEdit[],
): number | null {
  const edit = edits.find(
    (candidate) =>
      candidate.moduleId === moduleId && candidate.parameterName === parameterName,
  )
  if (edit) return edit.rawValue

  const parameter = patch.modules
    .find((module) => module.moduleId === moduleId)
    ?.parameters.find((candidate) => candidate.key === parameterName)
  return typeof parameter?.rawValue === 'number' ? parameter.rawValue : null
}

export function withParameterEdit(
  edits: readonly ParameterEdit[],
  edit: ParameterEdit,
  originalRawValue: number,
): ParameterEdit[] {
  const next = edits.filter(
    (candidate) => parameterEditId(candidate) !== parameterEditId(edit),
  )
  if (edit.rawValue !== originalRawValue) next.push(edit)
  return next
}
