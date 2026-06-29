class ReviewSchema {
  constructor ({name, storageGroup, schemaElements = []}) {
    this.name = name.substr(0, 25)
    this.storageGroup = storageGroup
    this.schemaElements = schemaElements
  }

  toAnnotations () {

  }

  toAnnotation () {

  }

  fromAnnotation (annotation) {

  }

  fromAnnotations (annotations) {

  }
}

module.exports = ReviewSchema
