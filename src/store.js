import {
  warn,
  assert,
  remove,
  callHook,
  mapObject,
  mergeState,
  isPlainObject,
} from './utils'
import updateComponent from './update'
import Middleware, { COMMONACTION } from './middleware'

// global state namespace
export let GLOBALWORD = 'global'

const assertReducer = (state, action, reducer) => {
  const { setter, partialState } = reducer

  assert(
    !('partialState' in reducer),
    `You must defined "partialState" of "${action}".`,
  )

  assert(
    !partialState || typeof partialState !== 'object',
    `The partialState of "${action}" must be an object.`,
  )

  for (const key in partialState) {
    assert(
      state.hasOwnProperty(key),
      `The "${key}" already exists in global state,` +
        'Please don\'t repeat defined.'
    )
  }

  if (typeof setter !== 'function') {
    reducer.setter = () => {
      warn(
        `Can\'t set "${action}" value. ` +
          'Have you defined a setter?'
      )
    }
  }
  return reducer
}

export default class Store {
  constructor (hooks) {
    this.state = {}
    this.hooks = hooks
    this.reducers = []
    this.depComponents = []
    this.isDispatching = false
    this.middleware = new Middleware(this)
  }

  add (action, reducer) {
    const { partialState } = assertReducer(this.state, action, reducer)

    reducer.action = action
    this.reducers.push(reducer)
    this.state = mergeState(this.state, partialState)
  }

  dispatch (action, payload) {
    const { reducers, isDispatching } = this

    // if we in call dispatch process,
    // we don't allow call dispacth again.
    assert(
      isDispatching,
      'It is not allowed to call "dispatch" during dispatch execution.' +
        `\n\n   --- from [${action}] action.`
    )

    const reducer = reducers.find(v => v.action === action)

    assert(
      !reducer,
      `The "${action}" does not exist. ` +
        'Maybe you have not defined.'
    )

    const removeMiddleware = this.use(action, prevPayload => {
      // the current function is called only once
      removeMiddleware()

      const newPartialState = reducer.setter(this.state, prevPayload)
      this.state = mergeState(this.state, newPartialState)

      // update components
      updateComponent(this.depComponents, this.hooks)
    })

    // call middleware
    this.middleware.handle(action, payload)
  }

  // add middleware
  use (action, fn) {
    if (typeof action !== 'string') {
      fn = action
      action = COMMONACTION
    }

    const wrapfn = (payload, next) => {
      this.isDispatching = true
      // if call setter function throw an error,
      // the `isDispatching` need restore.
      try {
        fn(payload, next)
      } catch (err) {
        this.isDispatching = false

        // if the error hook exist, don't throw error
        if (this.hooks && typeof this.hooks[middlewareError] === 'function') {
          this.hooks[middlewareError](action, payload, err)
        } else {
          warn(`${err}\n\n   --- from [${action}] action.`)
        }
      }

      this.isDispatching = false
    }

    this.middleware.use(match, wrapfn)
    return () => this.middleware.remove(action, wrapfn)
  }

  // allow change `GLOBALWORD`.
  setNamespace (key) {
    if (typeof key === 'string') {
      GLOBALWORD = key
    }
  }

  // insert method
  _rewirteCfgAndAddDep (config, isPage) {
    const store = this
    const { data, storeConfig = {} } = config
    const { didUpdate, willUpdate, defineReducer, defineGlobalState } = storeConfig

    data 
      ? data[GLOBALWORD] = {}
      : config.data = { [GLOBALWORD]: {} }

    // this is a uitl method,
    // allow craete reducer in the page or component.
    if (typeof defineReducer === 'function') {
      defineReducer.call(store, store)
      delete config.storeConfig
    }

    const addDep = component => {
      callHook(this.hooks, 'addDep', [component, isPage])

      // if no used global state word,
      // no need to add dependencies.
      if (typeof defineGlobalState === 'function') {
        const defineObject = defineGlobalState.call(store, store)
        const createState = () => mapObject(defineObject, fn => fn(this.state))

        // get state used by the current component
        const usedState = createState()

        if (isPlainObject(usedState)) {
          // add component to depComponents
          this.depComponents.push({
            isPage,
            component,
            didUpdate,
            willUpdate,
            createState,
          })

          // set global state to view
          component.setData({ [GLOBALWORD]: usedState })
        }
      }
    }

    if (isPage) {
      const nativeLoad = config.onLoad
      const nativeUnload = config.onUnload

      config.onLoad = function (opts) {
        addDep(this)

        // rigister store to component within
        this.store = store
        if (typeof nativeLoad === 'function') {
          nativeLoad.call(this, opts)
        }
      }

      config.onUnload = function (opts) {
        if (typeof nativeUnload === 'function') {
          nativeUnload.call(this, opts)
        }

        // clear cache
        this.store = null
        remove(store.depComponents, this)
      }
    } else {
      // Component
      config.lifetimes = config.lifetimes || {}
      const nativeAttached = config.attached || config.lifetimes.attached
      const nativeDetached = config.detached || config.lifetimes.detached

      config.attached =
      config.lifetimes.attached = function (opts) {
        addDep(this)
        this.store = store

        if (typeof nativeAttached === 'function') {
          nativeAttached.call(this, opts)
        }
      }

      config.detached =
      config.lifetimes.detached = function (opts) {
        if (typeof nativeDetached === 'function') {
          nativeDetached.call(this, opts)
        }

        this.store = null
        remove(store.depComponents, this)
      }
    }
  }
}