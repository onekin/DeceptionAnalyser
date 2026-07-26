class Options {
  init () {
    if (window.location.href.includes('pages/options.html')) {
      this.initEndpointManagement()
    }
  }

  initEndpointManagement () {
    // Built-in provider presets. Add new entries here to extend the wizard.
    const providers = [
      {
        id: 'preset_openai',
        name: 'OpenAI',
        desc: 'GPT-4, GPT-4o...',
        url: 'https://api.openai.com/v1',
        needsKey: true,
        keyUrl: 'https://platform.openai.com/api-keys'
      },
      {
        id: 'preset_gemini',
        name: 'Google Gemini',
        desc: 'Gemini 2.5, 2.0...',
        url: 'https://generativelanguage.googleapis.com/v1beta/openai',
        needsKey: true,
        keyUrl: 'https://aistudio.google.com/app/apikey'
      },
      {
        id: 'preset_groq',
        name: 'Groq',
        desc: 'Llama, Mixtral...',
        url: 'https://api.groq.com/openai/v1',
        needsKey: true,
        keyUrl: 'https://console.groq.com/keys'
      },
      {
        id: 'preset_openrouter',
        name: 'OpenRouter',
        desc: 'Many models, one key',
        url: 'https://openrouter.ai/api/v1',
        needsKey: true,
        keyUrl: 'https://openrouter.ai/keys'
      },
      {
        id: 'preset_deepseek',
        name: 'DeepSeek',
        desc: 'DeepSeek V3, R1...',
        url: 'https://api.deepseek.com/v1',
        needsKey: true,
        keyUrl: 'https://platform.deepseek.com/api_keys'
      },
      {
        id: 'preset_mistral',
        name: 'Mistral AI',
        desc: 'Mistral, Codestral...',
        url: 'https://api.mistral.ai/v1',
        needsKey: true,
        keyUrl: 'https://console.mistral.ai/api-keys'
      },
      {
        id: 'preset_together',
        name: 'Together AI',
        desc: 'Open-source models',
        url: 'https://api.together.xyz/v1',
        needsKey: true,
        keyUrl: 'https://api.together.ai/settings/api-keys'
      },
      {
        id: 'preset_custom',
        name: 'Local / Custom',
        desc: 'Ollama, LM Studio...',
        url: '',
        needsKey: false,
        keyUrl: ''
      }
    ]

    const providerGrid = document.getElementById('providerGrid')
    const step2 = document.getElementById('step2')
    const step3 = document.getElementById('step3')
    const apiKeyHelpLink = document.getElementById('apiKeyHelpLink')
    const apiKeyInput = document.getElementById('endpointAPIKey')
    const saveEndpointButton = document.getElementById('saveEndpointButton')
    const endpointURLGroup = document.getElementById('endpointURLGroup')
    const endpointURLInput = document.getElementById('endpointURL')
    const loadingIndicator = document.getElementById('modelsLoadingIndicator')
    const modelDropdown = document.getElementById('modelDropdown')
    const summaryEl = document.getElementById('currentConfigSummary')
    const changeProviderButton = document.getElementById('changeProviderButton')
    const deleteEndpointButton = document.getElementById('deleteEndpointButton')

    let currentProvider = null
    let currentEndpointId = null
    let savedEndpoints = {}

    const resetWizard = () => {
      step2.style.display = 'none'
      step3.style.display = 'none'
      summaryEl.style.display = 'none'
      deleteEndpointButton.style.display = 'none'
      currentProvider = null
      currentEndpointId = null
      Array.from(providerGrid.children).forEach((card) => card.classList.remove('selected'))
    }

    const populateModelDropdown = (models, endpointId) => {
      modelDropdown.innerHTML = ''
      models.forEach((model) => {
        const option = document.createElement('option')
        option.value = model.value
        option.textContent = model.label
        modelDropdown.appendChild(option)
      })
      modelDropdown.disabled = models.length === 0
      chrome.runtime.sendMessage({ scope: 'llm', cmd: 'getSelectedModel', data: endpointId }, ({ model } = {}) => {
        if (model && modelDropdown.querySelector('option[value="' + model + '"]')) {
          modelDropdown.value = model
        } else if (modelDropdown.options.length > 0) {
          modelDropdown.value = modelDropdown.options[0].value
          chrome.runtime.sendMessage({
            scope: 'llm',
            cmd: 'setSelectedModel',
            data: { endpointId: endpointId, model: modelDropdown.value }
          })
        }
      })
    }

    const showStep3 = (endpoint) => {
      step2.style.display = 'none'
      step3.style.display = 'block'
      deleteEndpointButton.style.display = 'inline-block'
      modelDropdown.innerHTML = ''
      modelDropdown.disabled = true
      chrome.runtime.sendMessage({ scope: 'llm', cmd: 'getCachedModels', data: endpoint.id }, ({ models } = {}) => {
        summaryEl.style.display = 'block'
        if (models && models.length > 0) {
          populateModelDropdown(models, endpoint.id)
          summaryEl.classList.remove('llm-summary-warning')
          summaryEl.textContent = 'Connected to ' + endpoint.name
        } else {
          summaryEl.classList.add('llm-summary-warning')
          summaryEl.textContent = 'No models found. Check your API key.'
        }
      })
    }

    const selectProvider = (provider, existingSaved) => {
      currentProvider = provider
      if (existingSaved) {
        currentEndpointId = existingSaved.id
        showStep3(existingSaved)
        return
      }
      currentEndpointId = null
      step3.style.display = 'none'
      step2.style.display = 'block'
      apiKeyInput.value = ''
      apiKeyInput.placeholder = 'Paste your ' + provider.name + ' API key here'
      apiKeyHelpLink.style.display = provider.keyUrl ? 'inline' : 'none'
      apiKeyHelpLink.href = provider.keyUrl || '#'
      endpointURLInput.value = provider.url || ''
      endpointURLGroup.style.display = provider.id === 'preset_custom' ? 'block' : 'none'
      loadingIndicator.style.display = 'none'
      saveEndpointButton.disabled = false
      apiKeyInput.focus()
    }

    const renderProviders = () => {
      providerGrid.innerHTML = ''
      providers.forEach((provider) => {
        const existingSaved = savedEndpoints[provider.id]
        const card = document.createElement('div')
        card.className = 'provider-card' + (existingSaved ? ' selected' : '')
        card.dataset.id = provider.id
        card.innerHTML =
          '<div class="provider-name">' + provider.name + '</div>' +
          '<div class="provider-desc">' + (existingSaved ? 'Configured' : provider.desc) + '</div>'
        card.addEventListener('click', () => {
          Array.from(providerGrid.children).forEach((c) => c.classList.remove('selected'))
          card.classList.add('selected')
          selectProvider(provider, savedEndpoints[provider.id])
        })
        providerGrid.appendChild(card)
      })
    }

    const loadSavedEndpoints = () => {
      chrome.runtime.sendMessage({ scope: 'llm', cmd: 'getEndpoints' }, ({ endpoints } = {}) => {
        savedEndpoints = endpoints || {}
        renderProviders()
        chrome.runtime.sendMessage({ scope: 'llm', cmd: 'getSelectedEndpoint' }, ({ endpoint } = {}) => {
          if (endpoint) {
            const provider = providers.find((p) => p.id === endpoint.id)
            currentProvider = provider || null
            currentEndpointId = endpoint.id
            const card = providerGrid.querySelector('[data-id="' + endpoint.id + '"]')
            if (card) {
              Array.from(providerGrid.children).forEach((c) => c.classList.remove('selected'))
              card.classList.add('selected')
            }
            showStep3(endpoint)
          }
        })
      })
    }

    modelDropdown.addEventListener('change', () => {
      if (currentEndpointId) {
        chrome.runtime.sendMessage({
          scope: 'llm',
          cmd: 'setSelectedModel',
          data: { endpointId: currentEndpointId, model: modelDropdown.value }
        })
      }
    })

    saveEndpointButton.addEventListener('click', () => {
      if (!currentProvider) {
        return
      }
      const apiKey = apiKeyInput.value.trim()
      const url = currentProvider.id === 'preset_custom' ? endpointURLInput.value.trim() : currentProvider.url

      if (!url) {
        window.alert('Please provide a base URL.')
        return
      }
      if (currentProvider.needsKey && !apiKey) {
        window.alert('Please provide an API key.')
        return
      }

      loadingIndicator.style.display = 'block'
      saveEndpointButton.disabled = true

      const endpoint = {
        id: currentProvider.id,
        name: currentProvider.name,
        url: url,
        apiKey: apiKey,
        needsKey: currentProvider.needsKey,
        keyUrl: currentProvider.keyUrl
      }

      chrome.runtime.sendMessage({
        scope: 'llm',
        cmd: 'saveEndpointAndFetchModels',
        data: { endpoint: endpoint }
      }, (response = {}) => {
        loadingIndicator.style.display = 'none'
        saveEndpointButton.disabled = false
        if (!response || response.error) {
          window.alert('Failed to connect: ' + ((response && response.error) || 'unknown error'))
          return
        }
        currentEndpointId = response.savedId
        step2.style.display = 'none'
        loadSavedEndpoints()
      })
    })

    changeProviderButton.addEventListener('click', () => {
      resetWizard()
    })

    deleteEndpointButton.addEventListener('click', () => {
      if (!currentEndpointId) {
        return
      }
      if (!window.confirm('Remove this provider configuration?')) {
        return
      }
      chrome.runtime.sendMessage({ scope: 'llm', cmd: 'deleteEndpoint', data: currentEndpointId }, () => {
        resetWizard()
        loadSavedEndpoints()
      })
    })

    loadSavedEndpoints()
  }
}

export default Options
