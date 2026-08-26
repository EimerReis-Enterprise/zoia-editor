import type { PatchDocument } from '#/lib/domain/patch'

const ISSUE_URL =
  'https://github.com/EimerReis-Enterprise/zoia-editor/issues/new'

type ReportKind = 'app' | 'module'

type CompatibilityReportInput = {
  kind: ReportKind
  description: string
  expected?: string
  actual?: string
  hardwareTarget?: string
  firmwareVersion?: string
  patch?: PatchDocument | null
  patchHash?: string
  moduleId?: string
}

export function createCompatibilityReportUrl({
  kind,
  description,
  expected,
  actual,
  hardwareTarget,
  firmwareVersion,
  patch,
  patchHash,
  moduleId,
}: CompatibilityReportInput): string {
  const module = patch?.modules.find((candidate) => candidate.id === moduleId)
  const lines = ['## What happened?', description.trim(), '']

  if (kind === 'module') {
    lines.push(
      '## Hardware',
      `- Target: ${hardwareTarget?.trim() || 'Not provided'}`,
      `- Firmware: ${firmwareVersion?.trim() || 'Not provided'}`,
      '',
      '## Expected behavior',
      expected?.trim() || 'Not provided',
      '',
      '## Actual behavior',
      actual?.trim() || 'Not provided',
      '',
      '## Module configuration',
      `- Module: ${module?.name ?? 'Not provided'}`,
      `- Configuration ID: ${module?.configurationId ?? 'Not provided'}`,
      '',
    )
  }

  if (patch) {
    lines.push(
      '## Patch summary',
      `- Name: ${patch.name}`,
      `- Modules: ${patch.modules.length}`,
      `- Connections: ${patch.connections.length}`,
      `- SHA-256: ${patchHash || 'Calculating…'}`,
      '',
      'Attach the .zoia.json file manually if you are comfortable making it public.',
    )
  }

  const title =
    kind === 'module'
      ? `Compatibility: ${module?.name ?? 'Module'} on ${hardwareTarget ?? 'ZOIA'}`
      : 'App issue: '
  return `${ISSUE_URL}?${new URLSearchParams({
    template: 'compatibility-report.md',
    title,
    body: lines.join('\n'),
  })}`
}
