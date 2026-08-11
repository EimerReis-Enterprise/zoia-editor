/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    { name: 'no-circular-dependencies', severity: 'error', from: {}, to: { circular: true } },
    { name: 'infra-does-not-import-domain', severity: 'error', from: { path: '^src/lib/infra/' }, to: { path: '^src/lib/domain/' } },
    { name: 'lib-does-not-import-ui', severity: 'error', from: { path: '^src/lib/(domain|infra|utils)/' }, to: { path: '^src/(features|routes|components|hooks)/' } },
    { name: 'utils-remain-generic', severity: 'error', from: { path: '^src/lib/utils/' }, to: { path: '^src/lib/(api|domain|infra)/' } }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' }
  }
}
