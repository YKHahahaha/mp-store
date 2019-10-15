export function warn (message) {
  throw new Error(`\n\n[MpStore warn]: ${message}\n\n`)
}

export function assert (condition, message) {
  if (!condition) warn(message)
}

export function mergeState (oldState, newState) {
  return Object.freeze(
    Object.assign({}, oldState, newState)
  )
}

export function mixinMethods (config, methods) {
  for (const key in methods) {
    if (!(key in config)) {
      config[key] = methods[key]
    }
  }
}

// remove component from depsComponent
export function remove (list, component) {
  const index = list.findIndex(item => item.component === component)
  if (index > -1) {
    list.splice(index, 1)
  }
}

export function callHook (hooks, name, args) {
  if (hooks && typeof hooks[name] === 'function') {
    return hooks[name].apply(hooks, args)
  }
}

export function isEmptyObject (obj) {
  for (const k in obj){
    return false
  }
  return true
}

export function mapObject (obj, fn) {
  const destObject = {}
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      destObject[key] = fn(obj[key])
    }
  }
  return destObject
}

export function createWraper (target, before, after) {
  return function (...args) {
    let result

    if (typeof before === 'function') {
      before.apply(this, args)
    }

    if (typeof target === 'function') {
      result = target.apply(this, args)
    }

    if (typeof after === 'function') {
      after.apply(this, args)
    }

    return result
  }
}

export function isPlainObject (obj) {
  if (typeof obj !== 'object' || obj === null) return false

  const proto = Object.getPrototypeOf(obj)
  if (proto === null) return true

  let baseProto = proto
  while (Object.getPrototypeOf(baseProto) !== null) {
    baseProto = Object.getPrototypeOf(baseProto)
  }
  return proto === baseProto
}

export function clone (value, record = new WeakMap) {
  if (value === null || value === undefined) {
    return value
  }
  const primitiveType = typeof value

  if (
    primitiveType === 'string' ||
    primitiveType === 'number' ||
    primitiveType === 'boolean' ||
    primitiveType === 'function' ||
    value instanceof Date
  ) {
    return value
  }

  if (record.has(value)) return record.get(value)

  const result = typeof value.constructor !== 'function'
    ? Object.create(null) 
    : new value.constructor()

  record.set(value, result)

  for (const key in value) {
    result[key] = clone(value[key], record)
  }

  return result
}