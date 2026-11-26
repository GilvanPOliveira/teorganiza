import type { ZodTypeAny } from 'zod'

/**
 * A compact, readable picture of a zod schema for the model: field names,
 * types, enum values and whether a value may be null. Zod 3 has no JSON
 * Schema export, and the model needs a hint, not a contract; the real
 * check is the schema itself, when the record is written.
 */
export function describeShape(schema: ZodTypeAny): string {
  const def = schema._def as { typeName?: string } & Record<string, unknown>
  switch (def.typeName) {
    case 'ZodObject': {
      const shape = (schema as unknown as { shape: Record<string, ZodTypeAny> }).shape
      const fields = Object.entries(shape).map(([key, value]) => `${key}: ${describeShape(value)}`)
      return `{ ${fields.join('; ')} }`
    }
    case 'ZodString': {
      const checks = (def.checks as { kind: string; regex?: RegExp }[] | undefined) ?? []
      const regex = checks.find((check) => check.kind === 'regex')?.regex?.source ?? ''
      if (regex.includes(String.raw`\d{4}-\d{2}-\d{2}`)) return 'date YYYY-MM-DD'
      if (regex.includes(String.raw`\d{2}:\d{2}`)) return 'time HH:MM'
      return 'string'
    }
    case 'ZodNumber': {
      const checks = (def.checks as { kind: string }[] | undefined) ?? []
      return checks.some((check) => check.kind === 'int') ? 'integer' : 'number'
    }
    case 'ZodBoolean':
      return 'boolean'
    case 'ZodEnum':
      return (def.values as string[]).map((value) => JSON.stringify(value)).join(' | ')
    case 'ZodLiteral':
      return JSON.stringify(def.value)
    case 'ZodNullable':
      return `${describeShape(def.innerType as ZodTypeAny)} | null`
    case 'ZodOptional':
      return `${describeShape(def.innerType as ZodTypeAny)} (optional)`
    case 'ZodDefault':
      return describeShape(def.innerType as ZodTypeAny)
    case 'ZodArray':
      return `${describeShape(def.type as ZodTypeAny)}[]`
    case 'ZodEffects':
      return describeShape(def.schema as ZodTypeAny)
    default:
      return 'any'
  }
}
