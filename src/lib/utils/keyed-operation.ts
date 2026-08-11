export type CacheKeyValue =
  | string
  | number
  | boolean
  | null
  | readonly CacheKeyValue[]
  | { readonly [key: string]: CacheKeyValue }

type OperationDefinition<
  TCallArgs extends unknown[],
  TResult,
  TKeyArgs extends unknown[],
  TKey extends readonly CacheKeyValue[],
> = {
  execute: (...args: TCallArgs) => Promise<TResult>
  key: (...args: TKeyArgs) => TKey
}

type KeyedOperation<
  TCallArgs extends unknown[],
  TResult,
  TKeyArgs extends unknown[],
  TKey extends readonly CacheKeyValue[],
> = ((...args: TCallArgs) => Promise<TResult>) & {
  readonly key: (...args: TKeyArgs) => TKey
}

function createOperation<
  TCallArgs extends unknown[],
  TResult,
  TKeyArgs extends unknown[],
  TKey extends readonly CacheKeyValue[],
>(
  definition: OperationDefinition<TCallArgs, TResult, TKeyArgs, TKey>,
): KeyedOperation<TCallArgs, TResult, TKeyArgs, TKey> {
  return Object.assign(definition.execute, { key: definition.key })
}

export function createQuery<
  TCallArgs extends unknown[],
  TResult,
  TKeyArgs extends unknown[],
  TKey extends readonly CacheKeyValue[],
>(definition: OperationDefinition<TCallArgs, TResult, TKeyArgs, TKey>) {
  return createOperation(definition)
}

export function createMutation<
  TCallArgs extends unknown[],
  TResult,
  TKeyArgs extends unknown[],
  TKey extends readonly CacheKeyValue[],
>(definition: OperationDefinition<TCallArgs, TResult, TKeyArgs, TKey>) {
  return createOperation(definition)
}
