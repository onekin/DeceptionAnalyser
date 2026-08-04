const { ChatOpenAI } = require('@langchain/openai')
const { ChatAnthropic } = require('@langchain/anthropic')
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai')
const { ChatGroq } = require('@langchain/groq')
const { PromptTemplate } = require('@langchain/core/prompts')
const ChromeStorage = require('../utils/ChromeStorage')

class LLMManager {
  init () {
    // Initialize replier for requests related to storage
    this.initRespondent()
  }

  initRespondent () {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'llm') {
        if (request.cmd === 'getSelectedLLM') {
          // Bridge to the endpoint-based storage used by the provider wizard (options page)
          Promise.all([this.getEndpoints(), this.getSelectedEndpointId()]).then(([endpoints, selectedId]) => {
            const endpoint = selectedId && endpoints[selectedId]
            if (endpoint && endpoint.selectedModel) {
              sendResponse({ llm: { modelType: endpoint.id, model: endpoint.selectedModel } })
            } else {
              sendResponse({ llm: '' })
            }
          })
        } else if (request.cmd === 'setSelectedLLM') {
          let selectedLLM = request.data.llm
          selectedLLM = JSON.stringify(selectedLLM)
          ChromeStorage.setData('llm.selected', selectedLLM, ChromeStorage.local, (err) => {
            if (err) {
              sendResponse({ err: err })
            } else {
              sendResponse({ llm: selectedLLM })
            }
          })
        } else if (request.cmd === 'getAPIKEY') {
          // Bridge to the endpoint-based storage used by the provider wizard (options page)
          this.getEndpoints().then((endpoints) => {
            const endpoint = endpoints[request.data]
            sendResponse({ apiKey: (endpoint && endpoint.apiKey) || '' })
          })
        } else if (request.cmd === 'setAPIKEY') {
          let llm = 'llm.' + request.data.llm + 'key'
          let apiKey = request.data.apiKey
          apiKey = JSON.stringify(apiKey)
          ChromeStorage.setData(llm, apiKey, ChromeStorage.local, (err) => {
            if (err) {
              sendResponse({ err: err })
            } else {
              sendResponse({ apiKey: apiKey })
            }
          })
        } else if (request.cmd === 'getEndpoints') {
          this.getEndpoints().then((endpoints) => {
            sendResponse({ endpoints: endpoints })
          })
        } else if (request.cmd === 'getSelectedEndpoint') {
          Promise.all([this.getEndpoints(), this.getSelectedEndpointId()]).then(([endpoints, selectedId]) => {
            sendResponse({ endpoint: (selectedId && endpoints[selectedId]) || null })
          })
        } else if (request.cmd === 'saveEndpointAndFetchModels') {
          const endpoint = request.data.endpoint
          this.fetchModelsForEndpoint(endpoint).then((models) => {
            return this.getEndpoints().then((endpoints) => {
              endpoints[endpoint.id] = Object.assign({}, endpoints[endpoint.id], endpoint, { models: models })
              return this.saveEndpoints(endpoints)
                .then(() => this.setSelectedEndpointId(endpoint.id))
                .then(() => {
                  sendResponse({ savedId: endpoint.id, models: models })
                })
            })
          }).catch((err) => {
            sendResponse({ error: (err && err.message) || err.toString() })
          })
        } else if (request.cmd === 'getCachedModels') {
          this.getEndpoints().then((endpoints) => {
            const endpoint = endpoints[request.data]
            sendResponse({ models: (endpoint && endpoint.models) || [] })
          })
        } else if (request.cmd === 'getSelectedModel') {
          this.getEndpoints().then((endpoints) => {
            const endpoint = endpoints[request.data]
            sendResponse({ model: (endpoint && endpoint.selectedModel) || '' })
          })
        } else if (request.cmd === 'setSelectedModel') {
          this.getEndpoints().then((endpoints) => {
            const endpoint = endpoints[request.data.endpointId]
            if (endpoint) {
              endpoint.selectedModel = request.data.model
            }
            return this.saveEndpoints(endpoints)
          }).then(() => {
            sendResponse({ ok: true })
          })
        } else if (request.cmd === 'deleteEndpoint') {
          this.getEndpoints().then((endpoints) => {
            delete endpoints[request.data]
            return this.saveEndpoints(endpoints).then(() => this.getSelectedEndpointId()).then((selectedId) => {
              if (selectedId === request.data) {
                return this.setSelectedEndpointId(null)
              }
            })
          }).then(() => {
            sendResponse({ ok: true })
          })
        }
        return true
      }
    })

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'askLLM') {
        if (request.cmd === 'anthropic' || request.cmd === 'preset_anthropic') {
          const t0 = performance.now()
          this.askAnthropic(request).then(
            res => sendResponse({ res: res, apiTiming: (performance.now() - t0) / 1000 }),
            err => sendResponse({ err: err })
          )// Return the error inside the message handler
          return true // Return true inside the message handler
        } else if (request.cmd === 'openAI') {
          const t0 = performance.now()
          this.askOpenAI(request).then(
            res => sendResponse({ res: res, apiTiming: (performance.now() - t0) / 1000 }),
            err => sendResponse({ err: err })
          )// Return the error inside the message handler
          return true // Return true inside the message handler
        } else if (request.cmd === 'gemini') {
          const t0 = performance.now()
          this.askGemini(request).then(
            res => sendResponse({ res: res, apiTiming: (performance.now() - t0) / 1000 }),
            err => sendResponse({ err: err })
          )// Return the error inside the message handler
          return true // Return true inside the message handler
        } else if (request.cmd === 'groq') {
          const t0 = performance.now()
          this.askGroq(request).then(
            res => sendResponse({ res: res, apiTiming: (performance.now() - t0) / 1000 }),
            err => sendResponse({ err: err })
          )// Return the error inside the message handler
          return true // Return true inside the message handler
        } else if (request.cmd === 'openrouter') {
          const t0 = performance.now()
          this.askOpenRouter(request).then(
            res => sendResponse({ res: res, apiTiming: (performance.now() - t0) / 1000 }),
            err => sendResponse({ err: err })
          )
          return true
        } else {
          // Generic OpenAI-compatible endpoint created via the provider wizard (options page)
          const t0 = performance.now()
          this.getEndpoints().then((endpoints) => {
            const endpoint = endpoints[request.cmd]
            if (!endpoint || !endpoint.url) {
              sendResponse({ err: 'Unknown LLM endpoint: ' + request.cmd })
              return
            }
            return this.askOpenAICompatible(request, endpoint.url).then(
              res => sendResponse({ res: res, apiTiming: (performance.now() - t0) / 1000 }),
              err => sendResponse({ err: err })
            )
          })
          return true
        }
      }
    })
  }

  // Helpers for the endpoint-based storage used by the provider wizard (options page)
  getEndpoints () {
    return new Promise((resolve) => {
      ChromeStorage.getData('llm.endpoints', ChromeStorage.local, (err, data) => {
        if (err || !data) {
          resolve({})
          return
        }
        try {
          resolve(JSON.parse(data) || {})
        } catch (e) {
          resolve({})
        }
      })
    })
  }

  saveEndpoints (endpoints) {
    return new Promise((resolve) => {
      ChromeStorage.setData('llm.endpoints', JSON.stringify(endpoints), ChromeStorage.local, () => resolve())
    })
  }

  getSelectedEndpointId () {
    return new Promise((resolve) => {
      ChromeStorage.getData('llm.selectedEndpointId', ChromeStorage.local, (err, data) => {
        if (err || !data) {
          resolve(null)
          return
        }
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          resolve(null)
        }
      })
    })
  }

  setSelectedEndpointId (id) {
    return new Promise((resolve) => {
      ChromeStorage.setData('llm.selectedEndpointId', JSON.stringify(id), ChromeStorage.local, () => resolve())
    })
  }

  // Connects to an OpenAI-compatible "/models" endpoint and returns the available models
  async fetchModelsForEndpoint (endpoint) {
    const baseURL = (endpoint.url || '').replace(/\/+$/, '')
    if (!baseURL) {
      throw new Error('Base URL is required')
    }
    const headers = { 'Content-Type': 'application/json' }
    if (endpoint.needsKey !== false && endpoint.apiKey) {
      if (baseURL.includes('api.anthropic.com')) {
        headers['x-api-key'] = endpoint.apiKey
        headers['anthropic-version'] = '2023-06-01'
      } else {
        headers.Authorization = 'Bearer ' + endpoint.apiKey
      }
    }
    let response
    try {
      response = await fetch(baseURL + '/models', { method: 'GET', headers: headers })
    } catch (err) {
      throw new Error('Network error while contacting the provider: ' + err.message)
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Incorrect API key provided.')
      }
      throw new Error('Request failed with status ' + response.status)
    }
    let json
    try {
      json = await response.json()
    } catch (err) {
      throw new Error('Unexpected response from provider.')
    }
    const list = Array.isArray(json.data) ? json.data : (Array.isArray(json.models) ? json.models : [])
    const models = list
      .map((m) => {
        const id = (m && (m.id || m.name || m.model)) || ''
        return { value: id, label: id }
      })
      .filter((m) => !!m.value)
    models.sort((a, b) => a.label.localeCompare(b.label))
    if (models.length === 0) {
      throw new Error('No models found for this provider.')
    }
    return models
  }

  async askGemini (request) {
    const apiKey = request.data.apiKey
    const query = request.data.query
    const documents = request.data.documents || ''
    const modelName = request.data.llm.model
    const model = new ChatGoogleGenerativeAI({
      apiKey: apiKey,
      model: modelName
    })

    const promptTemplate = PromptTemplate.fromTemplate(
      'CONTENT: {content}. {query}'
    )
    // Create QA chain
    const chain = promptTemplate.pipe(model)
    return chain.invoke({ query: query, content: documents }).then(res => {
      return res.text // Return the result so it can be used in the next .then()
    }).catch(async err => {
      console.log(err.toString())
      if (err.toString().startsWith('Error: 401')) {
        return { error: 'Incorrect API key provided.' }
      } else {
        return { error: err.toString() }
      }
    })
  }

  async askOpenAI (request) {
    const apiKey = request.data.apiKey
    const query = request.data.query
    const documents = request.data.documents || ''
    // create model
    const modelName = request.data.llm.model
    const model = new ChatOpenAI({
      model: modelName,
      apiKey, // use this (works in modern @langchain/openai),
      useResponsesApi: true
    })

    const promptTemplate = PromptTemplate.fromTemplate(
      'CONTENT: {content}. {query}'
    )
    // Create QA chain
    const chain = promptTemplate.pipe(model)
    return chain.invoke({ query: query, content: documents }).then(res => {
      return res.text // Return the result so it can be used in the next .then()
    }).catch(async err => {
      console.log(err.toString())
      if (err.toString().startsWith('Error: 429')) {
        return { error: 'Incorrect API key provided.' + err.toString() }
      } else if (err.toString().startsWith('Error: 401')) {
        return { error: 'Incorrect API key provided.' }
      } else {
        return { error: 'An error has occurred trying first call.' }
      }
    })
  }

  async askAnthropic (request) {
    const apiKey = request.data.apiKey
    const query = request.data.query
    const modelName = request.data.llm.model
    const documents = request.data.documents || ''
    // create model
    const model = new ChatAnthropic({
      anthropicApiKey: apiKey,
      modelName: modelName
    })

    const promptTemplate = PromptTemplate.fromTemplate(
      'CONTENT: {content}. {query}'
    )
    // Create QA chain
    const chain = promptTemplate.pipe(model)
    return chain.invoke({ query: query, content: documents }).then(res => {
      return res.text // Return the result so it can be used in the next .then()
    }).catch(async err => {
      console.log(err.toString())
      if (err.toString().startsWith('Error: 401')) {
        return { error: 'Incorrect API key provided.' }
      } else {
        return { error: err.toString() }
      }
    })
  }

  async askGroq (request) {
    const apiKey = request.data.apiKey
    const query = request.data.query
    const modelName = request.data.llm.model
    const documents = request.data.documents || ''
    // create model
    const model = new ChatGroq({
      apiKey: apiKey,
      model: modelName
    })
    const promptTemplate = PromptTemplate.fromTemplate(
      'CONTENT: {content}. {query}'
    )
    // Create QA chain
    const chain = promptTemplate.pipe(model)
    return chain.invoke({ query: query, content: documents }).then(res => {
      return res.text // Return the result so it can be used in the next .then()
    }).catch(async err => {
      console.log(err.toString())
      if (err.toString().startsWith('Error: 401')) {
        return { error: 'Incorrect API key provided.' }
      } else {
        return { error: err.toString() }
      }
    })
  }

  async askOpenRouter (request) {
    const apiKey = request.data.apiKey
    const query = request.data.query
    const documents = request.data.documents || ''
    const modelName = request.data.llm.model
    // Use OpenRouter's OpenAI-compatible API
    const model = new ChatOpenAI({
      model: modelName,
      apiKey,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'X-Title': 'DeceptionAnalyser'
        }
      }
    })

    const promptTemplate = PromptTemplate.fromTemplate(
      'CONTENT: {content}. {query}'
    )
    const chain = promptTemplate.pipe(model)
    return chain.invoke({ query: query, content: documents }).then(res => {
      return res.text
    }).catch(async err => {
      console.log(err.toString())
      if (err.toString().startsWith('Error: 401')) {
        return { error: 'Incorrect API key provided.' }
      } else if (err.toString().startsWith('Error: 429')) {
        return { error: 'Rate limit exceeded. ' + err.toString() }
      } else {
        return { error: err.toString() }
      }
    })
  }

  // Generic OpenAI-compatible chat call used for endpoints configured via the provider wizard
  async askOpenAICompatible (request, baseURL) {
    const apiKey = request.data.apiKey
    const query = request.data.query
    const documents = request.data.documents || ''
    const modelName = request.data.llm.model
    const model = new ChatOpenAI({
      model: modelName,
      apiKey,
      configuration: {
        baseURL: baseURL,
        defaultHeaders: {
          'X-Title': 'DeceptionAnalyser'
        }
      }
    })

    const promptTemplate = PromptTemplate.fromTemplate(
      'CONTENT: {content}. {query}'
    )
    const chain = promptTemplate.pipe(model)
    return chain.invoke({ query: query, content: documents }).then(res => {
      return res.text
    }).catch(async err => {
      console.log(err.toString())
      if (err.toString().startsWith('Error: 401')) {
        return { error: 'Incorrect API key provided.' }
      } else if (err.toString().startsWith('Error: 429')) {
        return { error: 'Rate limit exceeded. ' + err.toString() }
      } else {
        return { error: err.toString() }
      }
    })
  }
}

export default LLMManager
