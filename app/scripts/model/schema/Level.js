// Level is now a simple value object, stored as a property of PremiseAssessment
class Level {
  constructor ({ name, description = '' }) {
    this.name = name
    this.description = description
  }
}

module.exports = Level
