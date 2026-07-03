import ChromeStorage from '../utils/ChromeStorage'

// Map prompt type → default file path (relative to extension root)
const DEFAULT_PROMPT_FILES = {
  annotatePremisePrompt: 'prompts/annotatePremise.md',
  resolveConclusion: 'prompts/resolveConclusion.md',
  criticalQuestionPrompt: 'prompts/criticalQuestion.md',
}

// Cache for loaded default prompts (loaded once, reused forever)
const defaultPromptCache = {}

class PromptManager {
  init () {
    // Initialize replier for requests related to storage
    this.initRespondent()
  }

  /**
   * Load a default prompt from the bundled .md file.
   * Results are cached in memory after the first load.
   * @param {string} type - prompt type (e.g. 'annotatePremisePrompt')
   * @returns {Promise<string>} prompt text
   */
  async loadDefaultPrompt (type) {
    if (defaultPromptCache[type] !== undefined) {
      return defaultPromptCache[type]
    }
    const filePath = DEFAULT_PROMPT_FILES[type]
    if (!filePath) {
      defaultPromptCache[type] = ''
      return ''
    }
    try {
      const url = chrome.runtime.getURL(filePath)
      const res = await fetch(url)
      if (!res.ok) {
        defaultPromptCache[type] = ''
        return ''
      }
      const text = await res.text()
      defaultPromptCache[type] = text
      return text
    } catch (e) {
      console.warn('Failed to load default prompt "' + type + '" from ' + filePath, e)
      defaultPromptCache[type] = ''
      return ''
    }
  }

  initRespondent () {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'prompt') {
        if (request.cmd === 'getPrompt') {
          let type = request.data.type
          let searchKey = 'prompt.' + type
          ChromeStorage.getData(searchKey, ChromeStorage.sync, async (err, prompt) => {
            if (err) {
              sendResponse({ err: err })
            } else if (prompt && prompt.data) {
              let parsedPrompt = JSON.parse(prompt.data)
              sendResponse({ prompt: parsedPrompt || '' })
            } else {
              // No user-customized prompt in storage → load default from file
              const defaultPrompt = await this.loadDefaultPrompt(type)
              sendResponse({ prompt: defaultPrompt || '' })
            }
          })
        } else if (request.cmd === 'setPrompt') {
          let prompt = request.data.prompt
          let type = request.data.type
          let searchKey = 'prompt.' + type
          ChromeStorage.setData(searchKey, { data: JSON.stringify(prompt) }, ChromeStorage.sync, (err) => {
            if (err) {
              sendResponse({ err: err })
            } else {
              sendResponse({ prompt: prompt })
            }
          })
        }
        return true
      }
    })
  }
}

export default PromptManager
