const _ = require('lodash')

class AnnotationUtils {
  static getTagFromAnnotation (annotation, prefix) {
    return _.find(annotation.tags, (tag) => {
      return tag.startsWith(prefix)
    })
  }

  static modifyTag (annotation, oldTag, newTag) {
    let index = _.findIndex(annotation.tags, (tag) => { return oldTag === tag })
    if (index > -1) {
      annotation.tags[index] = newTag
      return annotation
    } else {
      return null
    }
  }

  static hasANamespace (annotation, namespace) {
    return _.findIndex(annotation.tags, (annotationTag) => {
      return _.startsWith(annotationTag.toLowerCase(), (namespace + ':').toLowerCase())
    }) !== -1
  }

  static hasATag (annotation, tag) {
    return _.findIndex(annotation.tags, (annotationTag) => {
      return annotationTag.toLowerCase() === tag.toLowerCase()
    }) !== -1
  }
}

module.exports = AnnotationUtils
