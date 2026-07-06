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
      { value: 'gpt-5.5-pro', label: 'GPT-5.5 Pro' },
      { value: 'gpt-5', label: 'GPT-5' },
      { value: 'gpt-4o', label: 'GPT-4o' }
    ],
    anthropic: [
      { value: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
      { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
      { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }
    ],
    groq: [
      { value: 'qwen/qwen3.6-27b', label: 'Qwen3.6 27B' },
      { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' }
    ],
    deepseek: [
      { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
      { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' }
    ],
    gemini: [
      { value: 'gemini-3.5-pro', label: 'Gemini 3.5 Pro' },
      { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }
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
