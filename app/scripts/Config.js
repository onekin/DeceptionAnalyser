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
    annotatePremisePrompt: 'Story: [The story is provided above]\n' +
      'Argument Scheme for analyzing deception:\n' + '[C_SCHEME]' +
      'Premise that I want to analyze: [C_NAME] premise\n' + 'Premise Description I want you to retrieve: [C_DESCRIPTION]\n' +
      'Based on the above, i want you to analyse the provided story according to the argument scheme provided.  You must state only the [C_NAME] premise based on the description. Please analyze the full story and generate a JSON response. The JSON must provide a text excerpt from the story that is associated with the statement of the premise. The excerpt should come to the point and be quite brief, so be thrifty. The format should be as follows:\n' +
      '{\n' +
      '"name": "[Premise Name]",\n' +
      '"statement": "[Statement of the premise based on the description, you have to rewrite it to the case in hand, for example you have to provide the values for the v, alpha, s, Agents and claims]",\n' +
      '"excerpt": "[Excerpt from the story that justifies the statement of the premise]",\n' +
      '}\n' +
      'When using this prompt, replace the placeholders with the actual content of the story and your answer.\n',
    compilePrompt: 'Research Paper Context: [The research paper is provided above]\n' +
      'Criterion for Evaluation: [C_NAME]\n' +
      'Criterion Description: [C_DESCRIPTION]\n' +
      'Paragraphs: [C_EXCERPTS]\n' +
      'Based on the above, you have to act as an academic reviewer and assess. For the criterion, you have to assess if it is met considering these possible results:' + ' Met, Partially met, or Not met. Then, you have to explain why it is met or not met. Base your opinion mainly in the above paragraphs. The JSON format should be as follows:\n' +
      '{\n' +
      '"name": "[Criterion Name]",\n' +
      '"sentiment": "[Met/Partially met/Not met]",\n' +
      '"comment": "[the reason of the results, if you mention one of the paragraphs in your comment reference the full paragraphs instead of the paragraph number]",\n' +
      '}\n' +
      'When using this prompt, replace the placeholders with the actual content of the research paper and the specific criterion details.\n',
    alternativePrompt: 'Research Paper Context: [The research paper is provided above]\n' +
      'Criterion for Evaluation: [C_NAME]\n' +
      'Criterion Description: [C_DESCRIPTION]\n' +
      'Paragraphs: [C_EXCERPTS]\n' +
      'You have to act as an academic reviewer and generate multiple alternative view points for the asessed criterion (Positive Viewpoint, Critical Viewpoint, Constructive Viewpoint, Alternative Viewpoint). Base on the above and base your opinion mainly in the above Paragraphs to analyze the full research paper and generate a JSON response. The JSON format should be as follows:\n' +
      '{\n' +
      '"name": "[Criterion Name]",\n' +
      '"answer": [provide different viewpoints in different bullet points using dashes (all in a single string), you have to put a "</br>" before each dash like "</br>-". You have to mark the different view point with bold xml tags (<b>). All the content must be specified in the answer key, without creating keys inside, if you mention one of the paragraphs in your answer reference the full paragraphs instead of the paragraph number)],\n' +
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
