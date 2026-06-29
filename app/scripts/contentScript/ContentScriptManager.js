import ReviewGenerator from '../exporter/ReviewGenerator'
import _ from 'lodash'
import ContentTypeManager from './ContentTypeManager'
import Sidebar from './Sidebar'
import CriteriaManager from './CriteriaManager'
import Events from './Events'
import GroupSelector from './GroupSelector'
import LocalStorageManager from '../storage/local/LocalStorageManager'
import Config from '../Config'
import Alerts from '../utils/Alerts'
import TextAnnotator from './contentAnnotators/TextAnnotator'
import CustomCriteriaManager from './CustomCriteriaManager'

class ContentScriptManager {
  constructor () {
    this.events = {}
    this.status = ContentScriptManager.status.notInitialized
  }

  init () {
    this.initListenerForGroupChange()
    this.status = ContentScriptManager.status.initializing
    this.loadContentTypeManager(() => {
      this.loadStorage(() => {
        window.abwa.sidebar = new Sidebar()
        window.abwa.sidebar.init(() => {
          window.abwa.groupSelector = new GroupSelector()
          window.abwa.groupSelector.init(() => {
            this.reloadContentByGroup(() => {
              // Initialize listener for group change to reload the content
              // Set status as initialized
              this.status = ContentScriptManager.status.initialized
            })
          })
        })
      })
    })
  }

  destroyContentAnnotator () {
    // Destroy current content annotator
    if (!_.isEmpty(window.abwa.contentAnnotator)) {
      window.abwa.contentAnnotator.destroy()
    }
  }

  destroyCriteriaManager () {
    if (!_.isEmpty(window.abwa.criteriaManager)) {
      window.abwa.criteriaManager.destroy()
    }
  }

  destroy (callback) {
    this.destroyContentTypeManager(() => {
      this.destroyCriteriaManager()
      this.destroyContentAnnotator()
      // TODO Destroy groupSelector, roleManager,
      window.abwa.groupSelector.destroy(() => {
        // Remove group change event listener
        document.removeEventListener(Events.groupChanged, this.events.groupChangedEvent)
        window.abwa.sidebar.destroy(() => {
          window.abwa.storageManager.destroy(() => {
            this.status = ContentScriptManager.status.notInitialized
            if (_.isFunction(callback)) {
              callback()
            }
          })
        })
      })
    })
  }

  initListenerForGroupChange () {
    this.events.groupChangedEvent = this.groupChangedEventHandlerCreator()
    document.addEventListener(Events.groupChanged, this.events.groupChangedEvent, false)
  }

  groupChangedEventHandlerCreator () {
    return (event) => {
      this.reloadContentByGroup()
    }
  }

  reloadContentByGroup (callback) {
    this.reloadCriteriaManager(() => {
      // Load content annotator
      this.reloadContentAnnotator(() => {
        // Reload specific content script
        this.reloadSpecificContentScript(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    })
  }

  reloadCriteriaManager (callback) {
    if (window.abwa.criteriaManager) {
      window.abwa.criteriaManager.destroy()
    }
    window.abwa.criteriaManager = new CriteriaManager(Config.review.namespace, Config.review.tags)
    window.abwa.criteriaManager.init(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  reloadContentAnnotator (callback) {
    if (window.abwa.contentAnnotator) {
      window.abwa.contentAnnotator.destroy()
    }
    window.abwa.contentAnnotator = new TextAnnotator(Config.review)
    window.abwa.contentAnnotator.init(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  reloadSpecificContentScript (callback) {
    // Initialize review generator and custom criteria manager
    window.abwa.specific = window.abwa.specific || {}
    if (window.abwa.specific.reviewGenerator) {
      window.abwa.specific.reviewGenerator.destroy()
    }
    if (window.abwa.specific.customCriteriaManager) {
      window.abwa.specific.customCriteriaManager.destroy()
    }
    window.abwa.specific.reviewGenerator = new ReviewGenerator()
    window.abwa.specific.customCriteriaManager = new CustomCriteriaManager()
    window.abwa.specific.reviewGenerator.init(() => {})
    window.abwa.specific.customCriteriaManager.init(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  loadContentTypeManager (callback) {
    window.abwa.contentTypeManager = new ContentTypeManager()
    window.abwa.contentTypeManager.init(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  destroyContentTypeManager (callback) {
    if (window.abwa.contentTypeManager) {
      window.abwa.contentTypeManager.destroy(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    }
  }

  loadStorage (callback) {
    window.abwa.storageManager = new LocalStorageManager()
    window.abwa.storageManager.init((err) => {
      if (err) {
        Alerts.errorAlert({text: 'Unable to initialize storage manager. Error: ' + err.message + '. ' +
            'Please reload webpage and try again.'})
      } else {
        window.abwa.storageManager.isLoggedIn((err, isLoggedIn) => {
          if (err) {
            if (_.isFunction(callback)) {
              callback(err)
            }
          } else {
            if (isLoggedIn) {
              if (_.isFunction(callback)) {
                callback()
              }
            } else {
              window.abwa.storageManager.logIn((err) => {
                if (err) {
                  callback(err)
                } else {
                  if (_.isFunction(callback)) {
                    callback()
                  }
                }
              })
            }
          }
        })
      }
    })
  }
}

ContentScriptManager.status = {
  initializing: 'initializing',
  initialized: 'initialized',
  notInitialized: 'notInitialized'
}

export default ContentScriptManager
