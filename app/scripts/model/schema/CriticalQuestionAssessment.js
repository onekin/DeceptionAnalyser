const Assessment = require('./Assessment')

class CriticalQuestionAssessment extends Assessment {
  constructor ({ document, adaptedQuestion, answer, excerpt, argument, counterargument, llm, timing }) {
    super({ document, llm, timing })
    this.adaptedQuestion = adaptedQuestion
    this.answer = answer
    this.excerpt = excerpt
    this.argument = argument
    this.counterargument = counterargument
  }
}

module.exports = CriticalQuestionAssessment
