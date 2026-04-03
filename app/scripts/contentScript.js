import ContentScriptManager from './contentScript/ContentScriptManager'

const _ = require('lodash')

console.debug('Loaded abwa content script')
if (_.isEmpty(window.abwa)) {
  window.abwa = {} // Global namespace for variables
  // Add listener for popup button click
  chrome.runtime.onMessage.addListener((msg) => {
    if (_.isEmpty(window.abwa.contentScriptManager)) {
      window.abwa.contentScriptManager = new ContentScriptManager()
    }
    if (msg.action === 'initContentScript') {
      if (window.abwa.contentScriptManager.status === ContentScriptManager.status.notInitialized) {
        window.abwa.contentScriptManager.init()
      }
    } else if (msg.action === 'destroyContentScript') {
      if (window.abwa.contentScriptManager.status === ContentScriptManager.status.initialized) {
        window.abwa.contentScriptManager.destroy(() => {
          window.abwa = {} // Clean window.abwa variable
        })
      }
    }
  })

  // Check if button is activated for this tab
  chrome.runtime.sendMessage({scope: 'extension', cmd: 'amIActivated'}, (response) => {
    // Check if the message was received (avoid "Could not establish connection" error)
    if (chrome.runtime.lastError) {
      console.debug('Background script not ready yet:', chrome.runtime.lastError.message)
      return
    }
    if (response && response.activated) {
      if (_.isEmpty(window.abwa.contentScriptManager)) {
        window.abwa.contentScriptManager = new ContentScriptManager()
        if (window.abwa.contentScriptManager.status === ContentScriptManager.status.notInitialized) {
          window.abwa.contentScriptManager.init()
        }
      }
    }
  })
}
