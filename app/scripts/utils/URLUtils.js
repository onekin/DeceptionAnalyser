const _ = require('lodash')

class URLUtils {
  
  /**
   * From a url, it removes hash params or other extra content which is not an unique source reference URL
   */
  static retrieveMainUrl (url) {
    return url.split('#')[0] // Remove the hash
  }
}

module.exports = URLUtils
