import _ from 'lodash'
import Config from '../Config'

class Options {
  init () {
    if (window.location.href.includes('pages/options.html')) {
      const defaultLLM = {
        modelType: 'openAI',
        model: 'gpt-4'
      }
      const openAIModels = Config.llmModels.openAI
      const anthropicModels = Config.llmModels.anthropic
      const groqModels = Config.llmModels.groq
      const geminiModels = Config.llmModels.gemini
      const deepseekModels = Config.llmModels.deepseek

      const LLMDropdown = document.getElementById('LLMDropdown')
      const modelSelectionContainer = document.getElementById('modelSelectionContainer')
      const modelDropdown = document.getElementById('modelDropdown')

      const openAIApiContainer = document.getElementById('openAI-ApiKeyContainer')
      const anthropicApiContainer = document.getElementById('anthropic-ApiKeyContainer')
      const groqApiContainer = document.getElementById('groq-ApiKeyContainer')
      const geminiApiContainer = document.getElementById('gemini-ApiKeyContainer')
      const deepseekApiContainer = document.getElementById('deepseek-ApiKeyContainer')

      const openAIModelInfoContainer = document.getElementById('openAI-models')
      const anthropicModelInfoContainer = document.getElementById('anthropic-models')
      const groqModelInfoContainer = document.getElementById('groq-models')
      const geminiModelInfoContainer = document.getElementById('gemini-models')
      const deepseekModelInfoContainer = document.getElementById('deepseek-models')

      // Hide models info
      openAIModelInfoContainer.style.display = 'none'
      anthropicModelInfoContainer.style.display = 'none'
      groqModelInfoContainer.style.display = 'none'
      geminiModelInfoContainer.style.display = 'none'
      deepseekModelInfoContainer.style.display = 'none'

      // Hide API key inputs initially
      openAIApiContainer.style.display = 'none'
      anthropicApiContainer.style.display = 'none'
      groqApiContainer.style.display = 'none'
      geminiApiContainer.style.display = 'none'
      deepseekApiContainer.style.display = 'none'

      // Handle LLM dropdown change
      document.querySelector('#LLMDropdown').addEventListener('change', (event) => {
        let selectedLLM = event.target.value
        resetModelDropdown()

        if (selectedLLM === 'openAI') {
          populateModelDropdown(openAIModels) // Populate the OpenAI models
        } else if (selectedLLM === 'anthropic') {
          populateModelDropdown(anthropicModels) // Populate the Anthropic models
        } else if (selectedLLM === 'groq') {
          populateModelDropdown(groqModels) // Populate the Groq models
        } else if (selectedLLM === 'gemini') {
          populateModelDropdown(geminiModels) // Populate the Gemini models
        } else if (selectedLLM === 'deepseek') {
          populateModelDropdown(deepseekModels) // Populate the DeepSeek models
        }

        // Ensure the selectedModel is correctly set
        let selectedModel = modelDropdown.value
        if (!selectedModel && modelDropdown.options.length > 0) {
          selectedModel = modelDropdown.options[0].value // Fallback to the first model
        }

        // Set the LLM after the model dropdown has been updated
        setLLM(selectedLLM, selectedModel)
        handleLLMChange(selectedLLM)
      })

      // Handle model dropdown change
      document.querySelector('#modelDropdown').addEventListener('change', (event) => {
        const selectedLLM = LLMDropdown.value
        const selectedModel = event.target.value
        setLLM(selectedLLM, selectedModel) // Update LLM with new model
      })

      chrome.runtime.sendMessage({
        scope: 'llm',
        cmd: 'getSelectedLLM'
      }, ({
        llm = defaultLLM
      }) => {
        document.querySelector('#LLMDropdown').value = llm.modelType || defaultLLM.modelType
        handleLLMChange(llm.modelType || defaultLLM.modelType) // Ensure the model dropdown gets populated
        modelDropdown.value = llm.model || defaultLLM.model
        setLLM(llm.modelType, llm.model)
      })

      // Update LLM (both provider and model)
      // eslint-disable-next-line no-inner-declarations
      function setLLM (llmProvider, model) {
        chrome.runtime.sendMessage({
          scope: 'llm',
          cmd: 'setSelectedLLM',
          data: {
            llm: {
              modelType: llmProvider,
              model: model
            }
          }
        }, ({
          llm
        }) => {
          console.debug('LLM selected ' + llm)
        })
        console.log('Selected LLM Provider: ' + llmProvider + ' Model: ' + model)
        updateTokenUsage(model)
      }

      // Handle changes in the LLM provider (like openAI or Anthropic)
      // eslint-disable-next-line no-inner-declarations
      function handleLLMChange (selectedLLM) {
        // Show/hide API Key inputs based on selected LLM
        if (selectedLLM === 'openAI') {
          modelSelectionContainer.style.display = 'block'
          openAIApiContainer.style.display = 'block'
          anthropicApiContainer.style.display = 'none'
          groqApiContainer.style.display = 'none'
          geminiApiContainer.style.display = 'none'
          // Hide models info
          openAIModelInfoContainer.style.display = 'block'
          anthropicModelInfoContainer.style.display = 'none'
          groqModelInfoContainer.style.display = 'none'
          geminiModelInfoContainer.style.display = 'none'
          populateModelDropdown(openAIModels)
        } else if (selectedLLM === 'anthropic') {
          modelSelectionContainer.style.display = 'block'
          openAIApiContainer.style.display = 'none'
          anthropicApiContainer.style.display = 'block'
          groqApiContainer.style.display = 'none'
          geminiApiContainer.style.display = 'none'
          // Hide models info
          openAIModelInfoContainer.style.display = 'none'
          anthropicModelInfoContainer.style.display = 'block'
          groqModelInfoContainer.style.display = 'none'
          geminiModelInfoContainer.style.display = 'none'
          populateModelDropdown(anthropicModels)
        } else if (selectedLLM === 'groq') {
          modelSelectionContainer.style.display = 'block'
          openAIApiContainer.style.display = 'none'
          anthropicApiContainer.style.display = 'none'
          groqApiContainer.style.display = 'block'
          geminiApiContainer.style.display = 'none'
          // Hide models info
          openAIModelInfoContainer.style.display = 'none'
          anthropicModelInfoContainer.style.display = 'none'
          groqModelInfoContainer.style.display = 'block'
          geminiModelInfoContainer.style.display = 'none'
          populateModelDropdown(groqModels)
        } else if (selectedLLM === 'gemini') {
          modelSelectionContainer.style.display = 'block'
          openAIApiContainer.style.display = 'none'
          anthropicApiContainer.style.display = 'none'
          groqApiContainer.style.display = 'none'
          geminiApiContainer.style.display = 'block'
          // Hide models info
          openAIModelInfoContainer.style.display = 'none'
          anthropicModelInfoContainer.style.display = 'none'
          groqModelInfoContainer.style.display = 'none'
          geminiModelInfoContainer.style.display = 'block'
          populateModelDropdown(geminiModels)
        } else if (selectedLLM === 'deepseek') {
          modelSelectionContainer.style.display = 'block'
          openAIApiContainer.style.display = 'none'
          anthropicApiContainer.style.display = 'none'
          groqApiContainer.style.display = 'none'
          geminiApiContainer.style.display = 'none'
          deepseekApiContainer.style.display = 'block'
          // Hide models info
          openAIModelInfoContainer.style.display = 'none'
          anthropicModelInfoContainer.style.display = 'none'
          groqModelInfoContainer.style.display = 'none'
          geminiModelInfoContainer.style.display = 'none'
          deepseekModelInfoContainer.style.display = 'block'
          populateModelDropdown(deepseekModels)
        } else {
          modelSelectionContainer.style.display = 'none'
          openAIApiContainer.style.display = 'none'
          anthropicApiContainer.style.display = 'none'
        }
        // Hide all storage configurations
        let APIKeyConfigurationCards = document.querySelectorAll('.APIKey-Configuration')
        APIKeyConfigurationCards.forEach((APIKeyConfigurationCard) => {
          APIKeyConfigurationCard.setAttribute('aria-hidden', 'true')
        })
        // Show corresponding selected LLM configuration card
        let selectedLLMConfiguration = document.querySelector('#' + selectedLLM + '-ApiKeyContainer')
        chrome.runtime.sendMessage({
          scope: 'llm',
          cmd: 'getAPIKEY',
          data: selectedLLM
        }, ({
          apiKey
        }) => {
          if (apiKey && apiKey !== '') {
            console.log('Retrieved API Key' + apiKey)
            let input = document.querySelector('#' + selectedLLM + '-APIKey')
            input.value = apiKey
            input.disabled = true
            let button = document.querySelector('#' + selectedLLM + '-APIKeyValidationButton')
            button.innerHTML = 'Change API Key value'
          } else {
            console.log('No retrieved API Key')
            document.querySelector('#' + selectedLLM + '-APIKey').value = ''
            document.querySelector('#' + selectedLLM + '-APIKey').placeholder = 'No API Key stored'
          }
        })
        if (_.isElement(selectedLLMConfiguration)) {
          selectedLLMConfiguration.setAttribute('aria-hidden', 'false')
        }
      }

      // eslint-disable-next-line no-inner-declarations
      function updateTokenUsage (model) {
        // Clear the dropdown before populating it
        chrome.runtime.sendMessage({
          scope: 'llm',
          cmd: 'getTokenUsage',
          data: {
            model: model
          }
        }, ({
          tokens
        }) => {
          if (tokens) {
            document.getElementById('completionTokens').textContent = tokens.completionTokens
            document.getElementById('promptTokens').textContent = tokens.promptTokens
            document.getElementById('totalTokens').textContent = tokens.totalTokens
          } else {
            document.getElementById('completionTokens').textContent = '0'
            document.getElementById('promptTokens').textContent = '0'
            document.getElementById('totalTokens').textContent = '0'
            console.warn('Token usage display element not found.')
          }
        })
      }

      // eslint-disable-next-line no-inner-declarations
      function populateModelDropdown (models) {
        // Clear the dropdown before populating it
        modelDropdown.innerHTML = ''

        models.forEach(function (model) {
          const option = document.createElement('option')
          option.value = model.value
          option.textContent = model.label
          modelDropdown.appendChild(option)
        })
        // Set the first option as the default selection if there is no current selection
        if (modelDropdown.options.length > 0) {
          modelDropdown.value = modelDropdown.options[0].value
        }
      }

      // eslint-disable-next-line no-inner-declarations
      function resetModelDropdown () {
        modelDropdown.innerHTML = '' // Reset by clearing all previous options
      }

      // API Key saving functionality
      const validationButtons = document.getElementsByClassName('APIKeyValidationButton')
      Array.from(validationButtons).forEach(button => {
        button.addEventListener('click', () => {
          let selectedLLM = document.querySelector('#LLMDropdown').value
          let button = document.querySelector('#' + selectedLLM + '-APIKeyValidationButton')
          if (button.innerHTML === 'Change API Key value') {
            let input = document.querySelector('#' + selectedLLM + '-APIKey')
            input.disabled = false
            button.innerHTML = 'Save'
          } else {
            let apiKey = document.querySelector('#' + selectedLLM + '-APIKey').value
            if (selectedLLM && apiKey) {
              setAPIKey(selectedLLM, apiKey)
            }
          }
        })
      })

      // eslint-disable-next-line no-inner-declarations
      function setAPIKey (selectedLLM, apiKey) {
        chrome.runtime.sendMessage({
          scope: 'llm',
          cmd: 'setAPIKEY',
          data: {
            llm: selectedLLM,
            apiKey: apiKey
          }
        }, ({
          apiKey
        }) => {
          console.log('APIKey stored ' + apiKey)
          let button = document.querySelector('#' + selectedLLM + '-APIKeyValidationButton')
          button.innerHTML = 'Change API Key value'
          let input = document.querySelector('#' + selectedLLM + '-APIKey')
          input.disabled = true
        })
      }
    }
  }
}

export default Options
