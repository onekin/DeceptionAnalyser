const LanguageUtils = require('../../utils/LanguageUtils')
const ReviewSchema = require('./ReviewSchema')

class SchemaElement {
  constructor ({name, parentElement, childElements = [], color = 'rgba(125,125,125,1)'}) {
    this.name = name
    this.color = color
    this.parentElement = parentElement
    this.childElements = childElements
  }

  toAnnotations () {

  }

  toAnnotation () {

  }

  fromAnnotations () {

  }

  fromAnnotation () {

  }

  getAncestor () {
    let parent = this.parentElement
    while (LanguageUtils.isInstanceOf(parent, SchemaElement)) {
      parent = parent.parentElement
    }
    if (LanguageUtils.isInstanceOf(parent, ReviewSchema)) {
      return parent
    }
  }
}

module.exports = SchemaElement
