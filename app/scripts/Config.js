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
  },
  prompts: {
    annotatePremisePrompt: 'STORY: [The story is provided above]\n' +
      'Argument Scheme for analyzing deception:\n' + '[C_SCHEME]' +
      'Premise that I want to analyze: [C_NAME] premise\n' + 'Premise Description I want you to retrieve this statement: [C_DESCRIPTION]\n' +
      'Based on the above, i want you to analyse the provided story according to the argument scheme provided.  You must state only the [C_NAME] premise based on the description. Please analyze the full story and generate a JSON response. The JSON must provide a text excerpt from the story, as it is written in the story, that is associated with the statement of the premise. The excerpt should come to the point and be quite brief, so be thrifty. The format should be as follows:\n' +
      '{\n' +
      '"name": "[C_NAME]",\n' +
      '"statement": "[Statement of the premise based on the description, you have to rewrite it to the case in hand, for example you have to provide the values for the v, alpha, s, Agents and claims]",\n' +
      '"excerpt": "[Excerpt from the story that justifies the statement of the premise. Exact substring from STORY]",\n' +
      '"sentiment": "[A traffic light color: return \'green\' if the premise is fulfilled and supported, \'yellow\' if undecided, and \'red\' if is unsupported]"\n' +
      '}\n' +
      'When using this prompt, replace the placeholders with the actual content of the story and your answer. CONSTRAINTS:\n' +
      '- The excerpt MUST be found in the STORY (case-sensitive).\n' +
      '- Do NOT include any text outside the JSON.\n' +
      '- the excerpt contains unescaped double quotes. In JSON, strings must use double quotes, so any inner " must be escaped as "\n',
    resolveConclusion: 'STORY: [The story is provided above]\n' +
      'Argument Scheme:\n' + '[C_SCHEME]' +
      'Premise Assessments:\n[C_PREMISES]\n\n' +
      'TASK:\n' +
      'You are to analyze the conclusion based on the argument scheme and the assessments of the premises.\n\n' +
      '[C_DESCRIPTION]\n\n' +
      'Please analyze the entire story and produce a structured JSON response. Your analysis should be aligned with the argument scheme and focused solely on the [C_NAME].\n\n' +
      'The JSON output must follow this format:\n' +
      '{\n' +
      '  "name": "Conclusion",\n' +
      '  "statement": "[Clearly rewritten conclusion specific to the story context, including concrete values for v, alpha, s, Agents, and claims as applicable]",\n' +
      '  "sentiment": "[A traffic light color: return \'green\' if the conclusion is highly deceptive and should be scrutinized, \'yellow\' if undecided or uncertain, and \'red\' if there is no sign of deception]"\n' +
      '}\n\n' +
      'Only return the JSON object in your response. Replace all placeholders with specific details from the story and your analysis.',
    criticalQuestionPrompt: 'Story: [The story is provided above]\n' +
      'Argument Scheme for analyzing deception:\n' + '[C_SCHEME]' +
      'Now I want to answer a critical question for Argument deception. The critical question is: [C_DESCRIPTION]\n' +
      'Based on the above, I want you to analyse the provided story, then instantiate the question with the values from the story and answer the question. ' +
      'I want to provide an argument and counterargument for the given critical questions, specifying the available evidence that supports the argument and counter-argument and the available counter-evidence that falsifies the argument or the counter-argument.\n' +
      'Please analyze the full story and generate a JSON response. The JSON must provide a text excerpt from the story that supports your answer for the question. The excerpt should come to the point and be quite brief, so be thrifty. The format should be as follows:\n' +
      '{\n' +
      '"name": "[C_NAME]",\n' +
      '"adaptedQuestion": "the question [C_DESCRIPTION], but rewritten with the values of the story",\n' +
      '"answer": "[Statement of the premise based on the description, you have to rewrite it to the case in hand, for example you have to provide the values for the v, alpha, s, Agents and claims]",\n' +
      '"excerpt": "[Provide one excerpt from the story that justifies the statement of the premise. Exact substring from STORY. In JSON, strings must use double quotes, so any inner \\" must be escaped]",\n' +
      '"argument": "[Your argument reasoning]",\n' +
      '"counterargument": "[Your counterargument reasoning]",\n' +
      '}\n' +
      'When using this prompt, replace the placeholders with the actual content of the story and your answer. CONSTRAINTS:\n' +
      '- The excerpt MUST be found in the STORY (case-sensitive).\n' +
      '- Do NOT include any text outside the JSON.\n' +
      '- the excerpt contains unescaped double quotes. In JSON, strings must use double quotes, so any inner " must be escaped"\n'
  }
}

export default Config
