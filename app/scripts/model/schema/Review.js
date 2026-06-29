const ReviewSchema = require('./ReviewSchema')
const Premise = require('./Premise')
const CriticalQuestion = require('./CriticalQuestion')
const LanguageUtils = require('../../utils/LanguageUtils')
const DefaultCriteria = require('./DefaultCriteria')

class Review extends ReviewSchema {
  constructor ({reviewId = '', storageGroup = ''}) {
    super({name: reviewId, storageGroup})
    this.criterias = this.schemaElements
  }

  _createCriterion ({ name, description, group, review, ...rest }) {
    if (group === 'Critical questions') {
      return new CriticalQuestion({ name, description, group, review, ...rest })
    }
    return new Premise({ name, description, group, review, ...rest })
  }

  toAnnotations () {
    let annotations = []
    annotations.push(this.toAnnotation())
    for (let i = 0; i < this.criterias.length; i++) {
      annotations = annotations.concat(this.criterias[i].toAnnotations())
    }
    return annotations
  }

  toAnnotation () {
    return {
      group: this.storageGroup.id,
      permissions: {
        read: ['group:' + this.storageGroup.id]
      },
      references: [],
      tags: ['review:default'],
      target: [],
      text: '',
      uri: this.storageGroup.links ? this.storageGroup.links.html : this.storageGroup.url
    }
  }

  static fromCriterias2 (criterias) {
    let review = new Review({reviewId: ''})
    for (let i = 0; i < criterias.length; i++) {
      let c = criterias[i]
      let criterion = this.prototype._createCriterion({
        name: c.name, description: c.description, group: c.group,
        review, feedback: c.feedback
      })
      review.criterias.push(criterion)
    }
    return review
  }

  static fromCriterias (criteriaJSON) {
    let review = new Review({ reviewId: '' })
    for (const group in criteriaJSON) {
      if (criteriaJSON.hasOwnProperty(group)) {
        const criteriaGroup = criteriaJSON[group]
        for (const name in criteriaGroup) {
          if (criteriaGroup.hasOwnProperty(name)) {
            const description = criteriaGroup[name].description
            let criterion = this.prototype._createCriterion({
              name, description, group, review
            })
            review.criterias.push(criterion)
          }
        }
      }
    }
    return review
  }

  static fromDeceptionSchema (criterias) {
    let review = new Review({reviewId: ''})
    for (let i = 0; i < criterias.length; i++) {
      let c = criterias[i]
      let criterion = this.prototype._createCriterion({
        name: c.name, description: c.description, group: c.group,
        review, feedback: c.feedback
      })
      review.criterias.push(criterion)
    }
    return review
  }

  toObject () {
    let object = {
      criteria: [],
      defaultLevels: DefaultCriteria.defaultLevels
    }
    for (let i = 0; i < this.criterias.length; i++) {
      let criteria = this.criterias[i]
      if (LanguageUtils.isInstanceOf(criteria, Premise) || LanguageUtils.isInstanceOf(criteria, CriticalQuestion)) {
        object.criteria.push(criteria.toObject())
      }
    }
    return object
  }
}

module.exports = Review
