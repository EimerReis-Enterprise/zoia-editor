import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const hardwareTargetSchema = z.enum(['zoia-pedal', 'euroburo'])

export const hardwareVerificationInputSchema = z.object({
  configurationId: z.string().min(1),
  parameterKey: z.string().min(1).optional(),
  hardwareTarget: hardwareTargetSchema,
  firmwareVersion: z.string().trim().min(1),
  verifiedBy: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
})

const hardwareVerificationRecordSchema = hardwareVerificationInputSchema.extend({
  id: z.string().min(1),
  verifiedAt: z.string().datetime(),
})

const registrySchema = z.object({
  format: z.literal('zoia-hardware-verifications'),
  schemaVersion: z.literal(1),
  records: z.array(hardwareVerificationRecordSchema),
})

export type HardwareTarget = z.infer<typeof hardwareTargetSchema>
export type HardwareVerificationRecord = z.infer<
  typeof hardwareVerificationRecordSchema
>

async function registryPath() {
  const { resolve } = await import('node:path')
  return resolve(process.cwd(), 'shared/hardware-verifications.v1.json')
}

async function readRegistry() {
  const { readFile } = await import('node:fs/promises')
  return registrySchema.parse(
    JSON.parse(await readFile(await registryPath(), 'utf8')),
  )
}

export const getHardwareVerifications = createServerFn({ method: 'GET' }).handler(
  async () => (await readRegistry()).records,
)

export const recordHardwareVerification = createServerFn({ method: 'POST' })
  .validator(hardwareVerificationInputSchema)
  .handler(async ({ data }) => {
    const { writeFile } = await import('node:fs/promises')
    const document = await readRegistry()
    const record = hardwareVerificationRecordSchema.parse({
      id: crypto.randomUUID(),
      ...data,
      verifiedAt: new Date().toISOString(),
    })
    document.records.push(record)
    await writeFile(
      await registryPath(),
      `${JSON.stringify(document, null, 2)}\n`,
    )
    return record
  })
