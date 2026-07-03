const Assessment = require('./Assessment')

class PremiseAssessment extends Assessment {
  constructor ({ document, statement, excerpt, justification, sentiment, level, llm, timing }) {
    super({ document, llm, timing })
    this.statement = statement    // LLM's rewritten premise statement
    this.excerpt = excerpt        // exact substring from the story
    this.justification = justification  // one-sentence rationale linking excerpt to statement
    this.sentiment = sentiment    // green | yellow | red
    this.level = level            // { name, description } e.g. "Major"
  }
}

module.exports = PremiseAssessment
