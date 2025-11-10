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
          ChromeStorage.getData('llm.selected', ChromeStorage.local, (err, llm) => {
            if (err) {
              sendResponse({ err: err })
            } else {
              if (llm) {
                let parsedLLM = JSON.parse(llm)
                sendResponse({ llm: parsedLLM || '' })
              } else {
                sendResponse({ llm: '' })
              }
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
          let llmKey = 'llm.' + request.data + 'key'
          ChromeStorage.getData(llmKey, ChromeStorage.local, (err, apiKey) => {
            if (err) {
              sendResponse({ err: err })
            } else {
              if (apiKey) {
                let parsedKey = JSON.parse(apiKey)
                sendResponse({ apiKey: parsedKey || '' })
              } else {
                sendResponse({ apiKey: '' })
              }
            }
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
        }
        return true
      }
    })

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'askLLM') {
        if (request.cmd === 'anthropic') {
          if (request.data.documents) {
            this.askAnthropic(request).then(
              res => sendResponse({ res: res }),
              err => sendResponse({ err: err })
            )// Return the error inside the message handler
          }
          return true // Return true inside the message handler
        } else if (request.cmd === 'openAI') {
          if (request.data.documents) {
            this.askOpenAI(request).then(
              res => sendResponse({ res: res }),
              err => sendResponse({ err: err })
            )// Return the error inside the message handler
          }
          return true // Return true inside the message handler
        } else if (request.cmd === 'gemini') {
          if (request.data.documents) {
            this.askGemini(request).then(
              res => sendResponse({ res: res }),
              err => sendResponse({ err: err })
            )// Return the error inside the message handler
          }
          return true // Return true inside the message handler
        } else if (request.cmd === 'groq') {
          if (request.data.documents) {
            this.askGroq(request).then(
              res => sendResponse({ res: res }),
              err => sendResponse({ err: err })
            )// Return the error inside the message handler
          }
          return true // Return true inside the message handler
        }
      }
    })
  }

  async askGemini (request) {
    const apiKey = request.data.apiKey
    const query = request.data.query
    const documents = request.data.documents
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
    const documents = request.data.documents
    // create model
    const modelName = request.data.llm.model
    const model = new ChatOpenAI({
      model: modelName,
      apiKey, // use this (works in modern @langchain/openai)
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
    const documents = request.data.documents
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
    const documents = request.data.documents
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
}

export default LLMManager
