const SchemaElement = require('./SchemaElement')
const CriticalQuestionAssessment = require('./CriticalQuestionAssessment')
const jsYaml = require('js-yaml')
const LanguageUtils = require('../../utils/LanguageUtils')

class CriticalQuestion extends SchemaElement {
  constructor ({ name, color, review, group = 'Critical questions', description, feedback, assessments = [] }) {
    super({ name, color, parentElement: review })
    this.group = group
    this.review = this.parentElement
    this.description = description
    this.feedback = feedback
    this.assessments = assessments  // CriticalQuestionAssessment[]
  }

  toAnnotations () {
    return [this.toAnnotation()]
  }

  toAnnotation () {
    let review = this.getAncestor()
    // Serialize assessments array — each entry holds the full CriticalQuestionAssessment
    let assessments = this.assessments.map(a => ({
      document: a.document,
      adaptedQuestion: a.adaptedQuestion,
      answer: a.answer,
      excerpt: a.excerpt,
      argument: a.argument,
      counterargument: a.counterargument,
      llm: a.llm
    }))
    return {
      group: review.storageGroup.id,
      permissions: {
        read: ['group:' + review.storageGroup.id]
      },
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
    // Read from new "assessments" field, with fallback to legacy "alternative" + "fullQuestion"
    let rawAssessments = config.assessments || []
    // Backward compat: if old format with separate alternative/fullQuestion arrays exists, merge them
    if (rawAssessments.length === 0 && (config.alternative || config.fullQuestion)) {
      let alternatives = config.alternative || []
      let fullQuestions = config.fullQuestion || []
      for (let i = 0; i < Math.max(alternatives.length, fullQuestions.length); i++) {
        let alt = alternatives[i] || {}
        let fq = fullQuestions[i] || {}
        rawAssessments.push({
          document: alt.document || fq.document,
          adaptedQuestion: fq.fullQuestion || '',
          answer: alt.answer || '',
          excerpt: alt.excerpt || '',
          argument: alt.argument || '',
          counterargument: alt.counterargument || '',
          llm: alt.llm || ''
        })
      }
    }
    let assessments = rawAssessments.map(a => new CriticalQuestionAssessment({
      document: a.document,
      adaptedQuestion: a.adaptedQuestion || '',
      answer: a.answer || '',
      excerpt: a.excerpt || '',
      argument: a.argument || '',
      counterargument: a.counterargument || '',
      llm: a.llm || ''
    }))
    return new CriticalQuestion({
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
        adaptedQuestion: a.adaptedQuestion,
        answer: a.answer,
        excerpt: a.excerpt,
        argument: a.argument,
        counterargument: a.counterargument,
        llm: a.llm
      }))
    }
  }
}

module.exports = CriticalQuestion
