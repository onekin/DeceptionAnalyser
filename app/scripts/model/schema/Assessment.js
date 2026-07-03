class Assessment {
  constructor ({ document, llm, timing }) {
    this.document = document  // pdfFingerprint
    this.llm = llm            // model used (anthropic, openai, etc.)
    this.timing = timing      // time required for the LLM call in seconds (float)
  }
}

module.exports = Assessment
