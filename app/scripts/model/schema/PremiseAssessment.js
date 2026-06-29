const Assessment = require('./Assessment')

class PremiseAssessment extends Assessment {
  constructor ({ document, statement, excerpt, sentiment, level, llm }) {
    super({ document, llm })
    this.statement = statement    // LLM's rewritten premise statement
    this.excerpt = excerpt        // exact substring from the story
    this.sentiment = sentiment    // green | yellow | red
    this.level = level            // { name, description } e.g. "Major"
  }
}

module.exports = PremiseAssessment
