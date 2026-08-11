import type { PatchProjection } from '#/lib/domain/patch'

export const demoPatch: PatchProjection = {
  id: 'demo-signal-chain',
  name: 'Parallel Atmosphere',
  sourceFilename: 'illustrative-demo.bin',
  stats: { moduleCount: 7, audioConnectionCount: 7, pageCount: 2 },
  modules: [
    ['module-input', 0, 'Stereo In', 'Audio Input', 'Interface', []],
    ['module-compressor', 1, 'Level Keeper', 'Compressor', 'Dynamics', [
      ['threshold', 'Threshold', '−18 dB', 32767, true],
      ['ratio', 'Ratio', '4:1', 43690, true],
    ]],
    ['module-delay', 2, 'Tape Echo', 'Delay Line', 'Audio', [
      ['time', 'Delay Time', '420 ms', 27525, true],
      ['mix', 'Mix', '38% normalized', 24903, false],
    ]],
    ['module-reverb', 3, 'Long Hall', 'Reverb Lite', 'Audio', [
      ['decay', 'Decay', '7.2 s', 47185, true],
      ['mix', 'Mix', '42% normalized', 27525, false],
    ]],
    ['module-mixer', 4, 'Return Bus', 'Audio Balance', 'Audio', [
      ['balance', 'Balance', 'Center', 32767, true],
    ]],
    ['module-limiter', 5, 'Safety', 'Limiter', 'Dynamics', [
      ['threshold', 'Threshold', '−1 dB', 58981, true],
    ]],
    ['module-output', 6, 'Stereo Out', 'Audio Output', 'Interface', []],
  ].map(([id, moduleId, name, type, category, parameters]) => ({
    id: String(id),
    moduleId: Number(moduleId),
    name: String(name),
    type: String(type),
    category: String(category),
    page: Number(moduleId) > 3 ? 1 : 0,
    parameters: (parameters as Array<[string, string, string, number, boolean]>).map(
      ([parameterId, parameterName, displayValue, rawValue, decoded]) => ({
        id: parameterId,
        key: parameterId,
        kind: 'parameter' as const,
        name: parameterName,
        displayValue,
        rawValue,
        decoded,
      }),
    ),
    incomingConnectionIds: [],
    outgoingConnectionIds: [],
  })),
  connections: [
    ['c1', 'module-input', 'module-compressor'],
    ['c2', 'module-compressor', 'module-delay'],
    ['c3', 'module-compressor', 'module-reverb'],
    ['c4', 'module-delay', 'module-mixer'],
    ['c5', 'module-reverb', 'module-mixer'],
    ['c6', 'module-mixer', 'module-limiter'],
    ['c7', 'module-limiter', 'module-output'],
  ].map(([id, sourceModuleId, targetModuleId]) => ({
    id,
    sourceModuleId,
    targetModuleId,
    sourceEndpoint: 'Audio Out',
    targetEndpoint: 'Audio In',
    strength: 100,
  })),
}

for (const connection of demoPatch.connections) {
  demoPatch.modules
    .find((module) => module.id === connection.sourceModuleId)
    ?.outgoingConnectionIds.push(connection.id)
  demoPatch.modules
    .find((module) => module.id === connection.targetModuleId)
    ?.incomingConnectionIds.push(connection.id)
}
