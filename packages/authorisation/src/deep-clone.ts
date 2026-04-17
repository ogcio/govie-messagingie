export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T
  }

  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as unknown as T
  }

  if (obj instanceof Map) {
    const clonedMap = new Map()
    obj.forEach((value, key) => {
      clonedMap.set(key, deepClone(value))
    })
    return clonedMap as unknown as T
  }

  if (obj instanceof Set) {
    const clonedSet = new Set()
    for (const value of obj) {
      clonedSet.add(deepClone(value))
    }
    return clonedSet as unknown as T
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as unknown as T
  }

  const clonedObj = {} as T
  for (const key in obj) {
    if (key in obj) {
      clonedObj[key] = deepClone(obj[key])
    }
  }

  return clonedObj
}
