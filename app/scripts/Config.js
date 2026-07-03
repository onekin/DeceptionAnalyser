const Config = {
  review: {
    groupName: 'DeceptionAnalyser',
    namespace: 'review',
    urlParamName: 'rag',
    defaultLLM: 'anthropic',
    tags: { // Defined tags for the domain
      grouped: { // Grouped annotations
        group: 'criteria',
        subgroup: 'level',
        relation: 'isCriteriaOf'
      }
    }
  },
  llmModels: {
    openAI: [
      { value: 'gpt-5', label: 'GPT-5' },
      { value: 'gpt-5-mini', label: 'GPT-5 mini' },
      { value: 'gpt-4.1', label: 'GPT-4.1' },
      { value: 'gpt-4o', label: 'GPT-4o' }
    ],
    anthropic: [
      { value: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
      { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }
    ],
    groq: [
      { value: 'qwen/qwen3-32b', label: 'Qwen3 32B' },
      { value: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick 17B' },
      { value: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B' }
    ],
    deepseek: [
      { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
      { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' }
    ],
    gemini: [
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' }
    ]
  },
  llmProviderLabels: {
    openAI: 'OpenAI',
    anthropic: 'Anthropic',
    groq: 'Groq',
    gemini: 'Gemini',
    deepseek: 'DeepSeek'
  },
  exportScope: {
    CURRENT_DOC_CURRENT_LLM: 1,
    CURRENT_DOC_ALL_LLM: 2,
    ALL_DOCS_CURRENT_LLM: 3,
    ALL_DOCS_ALL_LLM: 4
  }
}

export default Config
