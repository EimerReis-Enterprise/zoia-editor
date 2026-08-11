import { describe, expect, it } from 'vitest'

import { nodeDropTarget } from './node-reorder'

const moduleIds = ['input', 'a', 'b', 'c', 'output']
const centers = { input: 100, a: 300, b: 500, c: 700, output: 900 }

describe('nodeDropTarget', () => {
  it('places a dragged effect into the hovered Signal Chain gap', () => {
    expect(nodeDropTarget(moduleIds, centers, 'a', 650)).toEqual({
      afterModuleId: 'b',
      beforeModuleId: 'c',
    })
    expect(nodeDropTarget(moduleIds, centers, 'c', 200)).toEqual({
      afterModuleId: 'input',
      beforeModuleId: 'a',
    })
  })

  it('keeps fixed endpoints and ignores the current gap', () => {
    expect(nodeDropTarget(moduleIds, centers, 'input', 600)).toBeNull()
    expect(nodeDropTarget(moduleIds, centers, 'output', 200)).toBeNull()
    expect(nodeDropTarget(moduleIds, centers, 'b', 450)).toBeNull()
  })
})
