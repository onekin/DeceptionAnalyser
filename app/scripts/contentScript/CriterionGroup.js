const ColorUtils = require('../utils/ColorUtils')

class CriterionGroup {
  constructor (config, criteria) {
    this.config = config
    this.criteria = criteria || []
    this.config.color = this.config.color || 'rgba(150,150,150,0.5)'
  }

  getColor () {
    return ColorUtils.setAlphaToColor(this.config.color, 0.3)
  }
}

module.exports = CriterionGroup
