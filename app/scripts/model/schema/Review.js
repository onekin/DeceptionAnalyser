const AnnotationGuide = require('./AnnotationGuide')
const Criteria = require('./Criteria')
const LanguageUtils = require('../../utils/LanguageUtils')
const DefaultCriteria = require('../../specific/review/DefaultCriteria')

class Review extends AnnotationGuide {
  constructor ({reviewId = '', storageGroup = ''}) {
    super({name: reviewId, storageGroup})
    this.criterias = this.guideElements
  }

  toAnnotations () {
    let annotations = []
    annotations.push(this.toAnnotation())
    // Create annotations for all criterias
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
      uri: this.storageGroup.links ? this.storageGroup.links.html : this.storageGroup.url // Compatibility with both group representations getGroups and userProfile
    }
  }

  static fromCriterias2 (criterias) {
    let review = new Review({reviewId: ''})
    for (let i = 0; i < criterias.length; i++) {
      let criteria = new Criteria({name: criterias[i].name, description: criterias[i].description, custom: criterias[i].custom, group: criterias[i].group, resume: criterias[i].resume, alternative: criterias[i].alternative, review})
      review.criterias.push(criteria)
    }
    return review
  }

  static fromCriterias (criteriaJSON) {
    let review = new Review({ reviewId: '' })

    // Iterate over top-level groups: "Premises", "CriticalQuestions"
    for (const group in criteriaJSON) {
      if (criteriaJSON.hasOwnProperty(group)) {
        const criteriaGroup = criteriaJSON[group]

        // Iterate over individual criteria inside each group
        for (const name in criteriaGroup) {
          if (criteriaGroup.hasOwnProperty(name)) {
            const description = criteriaGroup[name].description

            let criteria = new Criteria({
              name: name,
              description: description,
              custom: true,
              group: group,
              resume: '',
              alternative: '',
              review: review
            })

            review.criterias.push(criteria)
          }
        }
      }
    }
    return review
  }

  static fromDeceptionSchema (criterias) {
    let review = new Review({reviewId: ''})
    for (let i = 0; i < criterias.length; i++) {
      let criteria = new Criteria({name: criterias[i].name, description: criterias[i].description, custom: criterias[i].custom, group: criterias[i].group, resume: criterias[i].resume, alternative: criterias[i].alternative, review})
      review.criterias.push(criteria)
    }
    return review
  }

  toObject () {
    let object = {
      criteria: [],
      defaultLevels: DefaultCriteria.defaultLevels
    }
    // For each criteria create the object
    for (let i = 0; i < this.criterias.length; i++) {
      let criteria = this.criterias[i]
      if (LanguageUtils.isInstanceOf(criteria, Criteria)) {
        object.criteria.push(criteria.toObject())
      }
    }
    return object
  }
}

module.exports = Review
