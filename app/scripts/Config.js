const Config = {
  review: {
    groupName: 'AnnotatorGPT',
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
  prompts: {
    annotatePremisePrompt: 'STORY: [The story is provided above]\n' +
      'Argument Scheme for analyzing deception:\n' + '[C_SCHEME]' +
      'Premise that I want to analyze: [C_NAME] premise\n' + 'Premise Description I want you to retrieve this statement: [C_DESCRIPTION]\n' +
      'Based on the above, i want you to analyse the provided story according to the argument scheme provided.  You must state only the [C_NAME] premise based on the description. Please analyze the full story and generate a JSON response. The JSON must provide a text excerpt from the story, as it is written in the story, that is associated with the statement of the premise. The excerpt should come to the point and be quite brief, so be thrifty. The format should be as follows:\n' +
      '{\n' +
      '"name": "[C_NAME]",\n' +
      '"statement": "[Statement of the premise based on the description, you have to rewrite it to the case in hand, for example you have to provide the values for the v, alpha, s, Agents and claims]",\n' +
      '"excerpt": "[Excerpt from the story that justifies the statement of the premise, you have to write it as it is in the story]",\n' +
      '}\n' +
      'When using this prompt, replace the placeholders with the actual content of the story and your answer.\n',
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
      '  "sentiment": "[A traffic light color: return \'red\' if the conclusion is highly deceptive and should be scrutinized, \'yellow\' if partially deceptive or uncertain, and \'green\' if there is no sign of deception]"\n' +
      '}\n\n' +
      'Only return the JSON object in your response. Replace all placeholders with specific details from the story and your analysis.',
    annotateAllPremisesPrompt: 'Story: [The story is provided above]\n' +
      'Argument Scheme for analyzing deception:\n' + '[C_SCHEME]' +
      'Based on the above, i want you to analyse the provided story according to the argument scheme provided.  You must state all the premises based on the schema, with the premises and their descriptions. Please analyze the full story and generate a JSON response. The JSON must provide a text excerpt from the story for each premises that is associated with the statement of the premise or conlusion. The excerpt should come to the point and be quite brief, so be thrifty. The format should be as follows:\n' +
      '[C_FORMAT]\n' +
      'When using this prompt, replace the placeholders with the actual content of the story and your answer.\n',
    argumentsPrompt: 'Research Paper Context: [The research paper is provided above]\n' +
      'Argument Scheme for analyzing deception:\n' + '[C_SCHEME]' +
      'The critical question is: [C_QUESTION]\n' +
      'And the answer you provided is: [C_ANSWER]\n' +
      'Now I want to provide an argument and counterargument for the given critical questions, specifying the available evidence that supports the argument and counter-argument and the available counter-evidence that falsifies the argument or the counter-argument.' +
      'You have to provide an argument and counterargument for the critical question. Base on the above generate a JSON response. The JSON format should be as follows:\n' +
      '{\n' +
      '"name": "[C_NAME]",\n' +
      '"answer": "provide an argument and counterargument for the given critical questions in different bullet points using dashes (all in a single string), you have to put a "</br>" before each dash like "</br>-". You have to provide the evidence after the argument and counter argument reasoning between paranthesis and in italic (<i>). All the content must be specified in the answer key, without creating keys inside.",\n' +
      '}\n' +
      'When using this prompt, replace the placeholders with the actual content of the research paper and the specific criterion details.\n',
    criticalQuestionPrompt: 'Story: [The story is provided above]\n' +
      'Argument Scheme for analyzing deception:\n' + '[C_SCHEME]' +
      'Now I want to answer a critical question for Argument deception. The critical question is: [C_DESCRIPTION]\n' +
      'Based on the above, i want you to analyse the provided story, then instantiate the question with the values from the story and answer the question. Please analyze the full story and generate a JSON response. The JSON must provide a text excerpt from the story that supports your answer for the question. The excerpt should come to the point and be quite brief, so be thrifty. The format should be as follows:\n' +
      '{\n' +
      '"adaptedQuestion": "the question [C_DESCRIPTION}, but rewritten with the values of the story",\n' +
      '"answer": "[Statement of the premise based on the description, you have to rewrite it to the case in hand, for example you have to provide the values for the v, alpha, s, Agents and claims]",\n' +
      '"excerpt": "[Excerpt from the story that justifies the statement of the premise]",\n' +
      '}\n' +
      'When using this prompt, replace the placeholders with the actual content of the story and your answer.\n',
    allCriticalQuestionPrompt: 'Story: [The story is provided above]\n' +
      'Argument Scheme for analyzing deception:\n' + '[C_SCHEME]' +
      'Critical questions:\n [C_QUESTIONS]\n' +
      'Based on the above, i want you to analyse the provided story, then instantiate each of the questions with the values from the story and answer the questions. Please analyze the full story and generate a JSON response. The JSON must provide a text excerpt from the story that supports your answers for the questions. The excerpt should come to the point and be quite brief, so be thrifty. The format should be as follows:\n' +
      '[C_FORMAT]\n' +
      'When using this prompt, replace the placeholders with the actual content of the story and your answer.\n',
    socialJudgePrompt: 'Is it socially appropriate to say the following text? <text>[C_EXCERPT]<text> as important.' +
      ' You have to provide the response in JSON format with' +
      ' the following keys: -"name" (contains the criteria name), -"answer" (the answer to the question. all the content must be specified in the answer key, without creating keys inside),',
    clarifyPrompt: 'I asked you to assess the following criterion for the provided research paper <criterion>[C_NAME]</criterion> and your considered the text excerpt found in triple quoted text <criterion>[C_EXCERPT]</criterion> as important. Therefore, now I would like to ask you [C_QUESTION]?' +
      ' You have to provide the response only in JSON format with a single key, which is answer' +
      ' the following keys: -"answer" (the answer to the question. all the content must be specified in the answer key, without creating keys inside),' +
      ' do not add more text to your answer apart from the json with the answer in the "answer key"'
  }
}

export default Config
