const SchemaElement = require('./SchemaElement')
const PremiseAssessment = require('./PremiseAssessment')
const jsYaml = require('js-yaml')
const LanguageUtils = require('../../utils/LanguageUtils')

class Premise extends SchemaElement {
  constructor ({ name, color, review, group = 'Premises', description, feedback, assessments = [] }) {
    super({ name, color, parentElement: review })
    this.group = group
    this.review = this.parentElement
    this.description = description
    this.feedback = feedback
    this.assessments = assessments  // PremiseAssessment[]
  }

  toAnnotations () {
    return [this.toAnnotation()]
  }

  toAnnotation () {
    let review = this.getAncestor()
    let assessments = this.assessments.map(a => ({
      document: a.document,
      answer: { statement: a.statement, excerpt: a.excerpt, sentiment: a.sentiment },
      level: a.level,
      llm: a.llm
    }))
    return {
      group: review.storageGroup.id,
      permissions: { read: ['group:' + review.storageGroup.id] },
      references: [],
      tags: ['review:criteria:' + LanguageUtils.normalizeString(this.name)],
      target: [],
      text: jsYaml.dump({
        description: this.description,
        group: this.group,
        assessments: assessments,
        feedback: this.feedback || []
      }),
      uri: review.storageGroup.links ? review.storageGroup.links.html : review.storageGroup.url
    }
  }

  static fromAnnotation (annotation, review) {
    let config = jsYaml.load(annotation.text)
    // Read from new "assessments" field, with fallback to legacy "compile"
    let rawAssessments = config.assessments || config.compile || []
    let assessments = rawAssessments.map(c => new PremiseAssessment({
      document: c.document,
      statement: c.answer?.statement,
      excerpt: c.answer?.excerpt,
      sentiment: c.answer?.sentiment,
      level: c.level,
      llm: c.llm
    }))
    return new Premise({
      name: config.name,
      description: config.description,
      group: config.group,
      feedback: config.feedback,
      review,
      assessments
    })
  }

  toObject () {
    return {
      name: this.name,
      description: this.description,
      group: this.group,
      feedback: this.feedback,
      assessments: this.assessments.map(a => ({
        document: a.document,
        statement: a.statement,
        excerpt: a.excerpt,
        sentiment: a.sentiment,
        level: a.level,
        llm: a.llm
      }))
    }
  }
}

module.exports = Premise
