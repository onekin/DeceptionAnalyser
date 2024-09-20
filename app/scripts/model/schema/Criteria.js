const GuideElement = require('./GuideElement')
const jsYaml = require('js-yaml')
const Level = require('./Level')
const LanguageUtils = require('../../utils/LanguageUtils')

class Criteria extends GuideElement {
  constructor ({name, color, review, group = 'Other', description, feedback, fullQuestion, custom = false, compile, alternative}) {
    super({name, color, parentElement: review})
    this.levels = this.childElements
    this.group = group
    this.review = this.parentElement
    this.description = description
    this.custom = custom
    if (compile) {
      this.compile = compile
    }
    if (feedback) {
      this.feedback = feedback
    }
    if (alternative) {
      this.alternative = alternative
    }
    if (fullQuestion) {
      this.fullQuestion = fullQuestion
    }
  }

  toAnnotations () {
    let annotations = []
    // Create its annotations
    annotations.push(this.toAnnotation())
    // Create its children annotations
    for (let i = 0; i < this.levels.length; i++) {
      annotations = annotations.concat(this.levels[i].toAnnotations())
    }
    return annotations
  }

  toAnnotation () {
    let review = this.getAncestor()
    let compile
    if (this.compile) {
      compile = this.compile
    } else {
      compile = ''
    }
    let alternative
    if (this.alternative) {
      alternative = this.alternative
    } else {
      alternative = ''
    }
    let feedback
    if (this.feedback) {
      feedback = this.feedback
    } else {
      feedback = ''
    }
    let fullQuestion
    if (this.fullQuestion) {
      fullQuestion = this.fullQuestion
    } else {
      fullQuestion = ''
    }
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
        fullQuestion: fullQuestion,
        group: this.group,
        custom: this.custom,
        alternative: alternative,
        compile: compile,
        feedback: feedback
      }),
      uri: review.storageGroup.links ? review.storageGroup.links.html : review.storageGroup.url // Compatibility with both group representations getGroups and userProfile
    }
  }

  static createCriteriaFromObject (criteria, rubric) {
    criteria.parentElement = rubric
    criteria.rubric = criteria.parentElement
    // Instance criteria object
    let instancedCriteria = Object.assign(new Criteria({}), criteria)
    // Instance levels
    for (let i = 0; i < criteria.levels.length; i++) {
      instancedCriteria.levels[i] = Level.createLevelFromObject(criteria.levels[i], instancedCriteria)
    }
    return instancedCriteria
  }

  toObject () {
    let object = {
      name: this.name,
      group: this.group,
      description: this.description,
      fullQuestion: this.fullQuestion,
      feedback: this.feedback,
      levels: []
    }
    if (this.custom) {
      object.custom = true
    }
    // For each level
    for (let i = 0; i < this.levels.length; i++) {
      let level = this.levels[i]
      if (LanguageUtils.isInstanceOf(level, Level)) {
        object.levels.push(level.toObject())
      }
    }
    return object
  }
}

module.exports = Criteria
