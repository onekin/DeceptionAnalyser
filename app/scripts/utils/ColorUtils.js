const ColorHash = require('color-hash')
const Color = require('color')
const UniqueColors = require('unique-colors')

class ColorUtils {
  static getRandomColor () {
    let red = (Math.floor(Math.random() * 256))
    let green = (Math.floor(Math.random() * 256))
    let blue = (Math.floor(Math.random() * 256))
    let alpha = Math.random()
    if (alpha < 0.5) {
      alpha = 0.5
    }
    return 'rgba(' + red + ',' + green + ',' + blue + ', ' + alpha + ')'
  }

  static colorFromString (str) {
    return new Color(str)
  }

  static getHashColor (text, alpha) {
    let colorHash = new ColorHash({hash: ColorUtils.customHash})
    let resultArray = colorHash.rgb(text)
    let alphaValue = alpha || 0.5
    return 'rgba(' + resultArray[0] + ',' + resultArray[1] + ',' + resultArray[2] + ', ' + alphaValue + ')'
  }

  static setAlphaToColor (color, alpha) {
    if (alpha === undefined) {
      return Color(color).rgb().string()
    } else {
      return Color(color).alpha(alpha).rgb().string()
    }
  }

  static customHash (str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      let char = str.charCodeAt(i)
      hash += char
    }
    return hash
  }

  static hasAlpha (str) {
    let color = new Color(str)
    return color.valpha !== 1
  }

  static getDifferentColors (number) {
    // Generate vibrant, distinct colors with better saturation and brightness
    const vibrantColors = [
      'rgba(236, 72, 153, 0.75)',    // Hot Pink
      'rgba(59, 130, 246, 0.75)',    // Blue
      'rgba(16, 185, 129, 0.75)',    // Emerald
      'rgba(249, 115, 22, 0.75)',    // Orange
      'rgba(168, 85, 247, 0.75)',    // Purple
      'rgba(239, 68, 68, 0.75)',     // Red
      'rgba(14, 165, 233, 0.75)',    // Sky Blue
      'rgba(132, 204, 22, 0.75)',    // Lime
      'rgba(251, 146, 60, 0.75)',    // Amber
      'rgba(139, 92, 246, 0.75)',    // Violet
      'rgba(245, 158, 11, 0.75)',    // Yellow
      'rgba(6, 182, 212, 0.75)',     // Cyan
      'rgba(244, 63, 94, 0.75)',     // Rose
      'rgba(34, 197, 94, 0.75)',     // Green
      'rgba(99, 102, 241, 0.75)'     // Indigo
    ]
    
    if (number <= vibrantColors.length) {
      return vibrantColors.slice(0, number)
    }
    
    // If we need more colors, supplement with the unique-colors library
    const baseColors = vibrantColors
    const additionalNeeded = number - vibrantColors.length
    const additionalColors = UniqueColors.unique_colors(additionalNeeded)
    return [...baseColors, ...additionalColors]
  }
}

module.exports = ColorUtils
