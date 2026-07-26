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
      { value: 'gpt-5.4', label: 'GPT-5.4' },
      { value: 'gpt-4o', label: 'GPT-4o' }
    ],
    anthropic: [
      { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }
    ],
    groq: [
      { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
      { value: 'qwen/qwen3.6-27b', label: 'Qwen 3.6 27B' }
    ],
    openrouter: [
      { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
      { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
      { value: 'openai/gpt-oss-20b', label: 'GPT OSS 20b' },
      { value: 'google/gemma-4-26b-a4b-it:free', label: 'Gemma 4 26B A4B IT' },
      { value: 'qwen/qwen3.6-27b', label: 'Qwen 3.6 27B' }
    ],
    gemini: [
      { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' }
    ]
  },
  llmProviderLabels: {
    openAI: 'OpenAI',
    anthropic: 'Anthropic',
    groq: 'Groq',
    gemini: 'Gemini',
    openrouter: 'OpenRouter'
  },
  exportScope: {
    CURRENT_DOC_CURRENT_LLM: 1,
    CURRENT_DOC_ALL_LLM: 2,
    ALL_DOCS_CURRENT_LLM: 3,
    ALL_DOCS_ALL_LLM: 4
  }
}

export default Config
