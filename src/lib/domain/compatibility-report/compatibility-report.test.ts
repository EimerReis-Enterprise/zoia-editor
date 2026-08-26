import { describe, expect, it } from 'vitest'

import { createCompatibilityReportUrl } from './compatibility-report'

const patch = {
  name: 'Public Patch',
  modules: [{ id: 'delay', name: 'Delay', configurationId: 'delay-clocked' }],
  connections: [{ id: 'connection' }],
} as never

describe('Compatibility Report', () => {
  it('prefills a public module report with a sanitized patch summary', () => {
    const url = new URL(
      createCompatibilityReportUrl({
        kind: 'module',
        description: 'The delay does not load.',
        expected: 'The patch loads.',
        actual: 'ZOIA shows an error.',
        hardwareTarget: 'Euroburo',
        firmwareVersion: '3.0',
        patch,
        patchHash: 'abc123',
        moduleId: 'delay',
      }),
    )

    expect(url.origin + url.pathname).toBe(
      'https://github.com/EimerReis-Enterprise/zoia-editor/issues/new',
    )
    expect(url.searchParams.get('template')).toBe('compatibility-report.md')
    expect(url.searchParams.get('body')).toContain(
      'Configuration ID: delay-clocked',
    )
    expect(url.searchParams.get('body')).toContain('SHA-256: abc123')
  })
})
