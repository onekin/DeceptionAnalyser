class Assessment {
  constructor ({ document, llm }) {
    this.document = document  // pdfFingerprint
    this.llm = llm            // model used (anthropic, openai, etc.)
  }
}

module.exports = Assessment
