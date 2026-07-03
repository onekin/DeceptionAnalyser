const general = require('./general.json')
const empty = require('./empty.json')
const concealment = require('./concealment.json')
const exaggeration = require('./exaggeration.json')
const framing = require('./framing.json')
const falseAnalogy = require('./falseAnalogy.json')
const misrepresentation = require('./misrepresentation.json')
const ambiguity = require('./ambiguity.json')
const deceptiveInvocation = require('./deceptiveInvocation.json')
const theoryOfMind = require('./theoryOfMind.json')
const positionToKnow = require('./positionToKnow.json')

const ReviewModels = {
  reviews: {
    deceptiveInfluence: {
      name: 'Argument from Deceptive Influence',
      schema: general
    },
    concealment: {
      name: 'Argument from Concealment',
      schema: concealment
    },
    exaggeration: {
      name: 'Argument from Exaggeration',
      schema: exaggeration
    },
    framing: {
      name: 'Argument from Framing',
      schema: framing
    },
    falseAnalogy: {
      name: 'Argument from False Analogy',
      schema: falseAnalogy
    },
    misrepresentation: {
      name: 'Argument from Misrepresentation',
      schema: misrepresentation
    },
    ambiguity: {
      name: 'Argument from Strategic Ambiguity',
      schema: ambiguity
    },
    deceptiveInvocation: {
      name: 'Argument from Deceptive Invocation',
      schema: deceptiveInvocation
    },
    theoryOfMind: {
      name: 'Argument from Theory of Mind',
      schema: theoryOfMind
    },
    positionToKnow: {
      name: 'Argument from Deceptive Position to Know',
      schema: positionToKnow
    }
  },
  empty: empty
}

module.exports = ReviewModels
