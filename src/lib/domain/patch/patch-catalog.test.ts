import { describe, expect, it } from 'vitest'

import { filterModuleCatalog, getModuleCatalog, groupModuleCatalog } from './patch-catalog'

describe('Module Configuration Registry presentation', () => {
  it('shows one compatible configuration per Module in safe linear authoring', async () => {
    const catalog = await getModuleCatalog()
    const linear = filterModuleCatalog(catalog, 'linear', '')

    expect(linear.map((configuration) => configuration.id)).toEqual([
      'vca',
      'filter',
      'compressor',
      'distortion',
      'delay',
      'reverb',
      'mixer',
    ])
    expect(new Set(linear.map((configuration) => configuration.name)).size).toBe(linear.length)
  })

  it('labels advanced option variants distinctly', async () => {
    const advanced = filterModuleCatalog(await getModuleCatalog(), 'free', '')
    const names = advanced.map((configuration) => configuration.name)

    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain('VCA · Mono')
    expect(names).toContain('VCA · Stereo')
    expect(names).toContain('SV Filter · Lowpass')
    expect(names).toContain('SV Filter · Highpass')

    const groups = groupModuleCatalog(advanced)
    const vca = groups.find((group) => group.name === 'VCA')
    expect(groups.filter((group) => group.name === 'VCA')).toHaveLength(1)
    expect(vca?.variants.map((variant) => variant.label)).toEqual(['Mono', 'Stereo'])
  })
})
