import LLMClient from '../../llm/LLMClient'
import LLMTextUtils from '../../utils/LLMTextUtils'
import Alerts from '../../utils/Alerts'
import LanguageUtils from '../../utils/LanguageUtils'
import Events from '../../contentScript/Events'
import Criteria from '../../model/schema/Criteria'
import Level from '../../model/schema/Level'
import Review from '../../model/schema/Review'
import DefaultCriteria from './DefaultCriteria'
import _ from 'lodash'
import $ from 'jquery'
import 'jquery-contextmenu/dist/jquery.contextMenu'
import Config from '../../Config'
import AnnotationUtils from '../../utils/AnnotationUtils'
import jsYaml from 'js-yaml'

class CustomCriteriasManager {
  constructor () {
    this.events = {}
  }

  init (callback) {
    this.createAddCustomCriteriaButtons(() => {
      // Initialize event handlers
      this.initEventHandler()
      // Init context menu for buttons
      this.initContextMenu()
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  initEventHandler () {
    this.events.tagsUpdated = {
      element: document,
      event: Events.tagsUpdated,
      handler: () => {
        // this.createAddCustomCriteriaButtons()
        this.initContextMenu()
      }
    }
    this.events.tagsUpdated.element.addEventListener(this.events.tagsUpdated.event, this.events.tagsUpdated.handler, false)
  }

  createAddCustomCriteriaButtons (callback) {
    // this.createAddCustomThemeButton()
    let groups = _.map(document.querySelectorAll('.tagGroup'), (tagGroupElement) => {
      return tagGroupElement.dataset.groupName
    })
    for (let i = 0; i < groups.length; i++) {
      // this.createAddCustomCriteriaButton(groups[i])
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createAddCustomThemeButton () {
    let addCustomThemeButton = document.querySelector('#addCustomThemeElement')
    if (!_.isElement(addCustomThemeButton)) {
      let criteriaHeader = document.querySelector('#groupSelectorContainerHeader')
      let addCustomThemeElement = document.createElement('span')
      addCustomThemeElement.id = 'addCustomThemeElement'
      addCustomThemeElement.classList.add('addCustomCriteriaWhite')
      criteriaHeader.insertAdjacentElement('afterbegin', addCustomThemeElement)
      addCustomThemeElement.addEventListener('click', this.createCustomTheme())
    }
  }

  createCustomTheme () {
    return () => {
      Alerts.inputTextAlert({
        title: 'Creating new review category',
        text: 'You can give a name to the factor that you want to review.',
        input: 'text',
        preConfirm: (themeName) => {
          let themeElement = document.querySelector('.tagGroup[data-group-name="' + themeName + '"')
          if (_.isElement(themeElement)) {
            const swal = require('sweetalert2')
            swal.showValidationMessage('A criteria group with that name already exists.')
            window.abwa.sidebar.openSidebar()
          } else {
            return themeName
          }
        },
        callback: (err, result) => {
          if (err) {
            window.alert('Unable to show form to add custom factor. Contact developer.')
          } else {
            let tagName = LanguageUtils.normalizeStringToValidID(result)
            this.createNewCustomCriteria({
              name: tagName,
              description: '',
              group: tagName,
              callback: () => {
                window.abwa.sidebar.openSidebar()
              }
            })
          }
        }
      })
    }
  }

  createNewCustomCriteria ({ name, description = 'Custom criteria', group, callback }) {
    let review = new Review({ reviewId: '' })
    review.storageGroup = window.abwa.groupSelector.currentGroup
    let criteria = new Criteria({ name, description, review, group: group, custom: true })
    // Create levels for the criteria
    let levels = DefaultCriteria.defaultLevels
    criteria.levels = []
    for (let j = 0; j < levels.length; j++) {
      let level = new Level({ name: levels[j].name, criteria: criteria })
      criteria.levels.push(level)
    }
    let annotations = criteria.toAnnotations()
    // Push annotations to storage
    window.abwa.storageManager.client.createNewAnnotations(annotations, (err) => {
      if (err) {
        Alerts.errorAlert({
          title: 'Unable to create a custom category',
          text: 'Error when trying to create a new custom category. Please try again.'
        })
        callback(err)
      } else {
        // Reload sidebar
        window.abwa.tagManager.reloadTags(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      }
    })
  }

  destroy () {
    // Remove event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
  }

  static deleteTag (tagGroup, callback) {
    // Get tags used in storage to store this tag or annotations with this tag
    let annotationsToDelete = []
    // Get annotation of the tag group
    annotationsToDelete.push(tagGroup.config.annotation.id)
    window.abwa.storageManager.client.searchAnnotations({
      tags: Config.review.namespace + ':' + Config.review.tags.grouped.relation + ':' + tagGroup.config.name
    }, (err, annotations) => {
      if (err) {
        // TODO Send message unable to delete
      } else {
        annotationsToDelete = annotationsToDelete.concat(_.map(annotations, 'id'))
        // Delete all the annotations
        let promises = []
        for (let i = 0; i < annotationsToDelete.length; i++) {
          promises.push(new Promise((resolve, reject) => {
            window.abwa.storageManager.client.deleteAnnotation(annotationsToDelete[i], (err) => {
              if (err) {
                reject(new Error('Unable to delete annotation id: ' + annotationsToDelete[i]))
              } else {
                resolve()
              }
            })
            return true
          }))
        }
        // When all the annotations are deleted
        Promise.all(promises).catch(() => {
          Alerts.errorAlert({ text: 'There was an error when trying to delete all the annotations for this tag, please reload and try it again.' })
        }).then(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      }
    })
  }

  static restoreTag (tagGroup, callback) {
    // Get tags used in storage to store this tag or annotations with this tag
    let annotationsToDelete = []
    window.abwa.storageManager.client.searchAnnotations({
      tags: Config.review.namespace + ':' + Config.review.tags.grouped.relation + ':' + tagGroup.config.name
    }, (err, annotations) => {
      if (err) {
        // TODO Send message unable to delete
      } else {
        annotationsToDelete = annotationsToDelete.concat(_.map(annotations, 'id'))
        // Delete all the annotations
        let promises = []
        for (let i = 0; i < annotationsToDelete.length; i++) {
          promises.push(new Promise((resolve, reject) => {
            window.abwa.storageManager.client.deleteAnnotation(annotationsToDelete[i], (err) => {
              if (err) {
                reject(new Error('Unable to delete annotation id: ' + annotationsToDelete[i]))
              } else {
                resolve()
              }
            })
            return true
          }))
        }
        // When all the annotations are deleted
        Promise.all(promises).catch(() => {
          Alerts.errorAlert({ text: 'There was an error when trying to delete all the annotations for this tag, please reload and try it again.' })
        }).then(() => {
          let oldAnnotation = tagGroup.config.annotation
          // Update annotation description
          // Create new annotation
          let review = new Review({ reviewId: '' })
          review.storageGroup = window.abwa.groupSelector.currentGroup
          let criteria = new Criteria({
            name: tagGroup.config.name,
            description: tagGroup.config.options.description,
            fullQuestion: '',
            compile: '',
            alternative: '',
            feedback: '',
            group: tagGroup.config.options.group,
            review,
            custom: true
          })
          let annotation = criteria.toAnnotation()
          window.abwa.storageManager.client.updateAnnotation(oldAnnotation.id, annotation, (err, annotation) => {
            if (err) {
              // TODO Show err
              if (_.isFunction(callback)) {
                callback(err)
              }
            } else {
              if (_.isFunction(callback)) {
                callback(annotation)
              }
            }
          })
        })
      }
    })
  }

  static deleteTagAnnotations (tag, callback) {
    // Get tags used in storage to store this tag or annotations with this tag
    let annotationsToDelete = []
    // Get annotation of the tag group
    window.abwa.storageManager.client.searchAnnotations({
      tags: tag[0]
    }, (err, annotations) => {
      if (err) {
        // TODO Send message unable to delete
      } else {
        annotationsToDelete = annotationsToDelete.concat(_.map(annotations, 'id'))
        // Delete all the annotations
        let promises = []
        for (let i = 0; i < annotationsToDelete.length; i++) {
          promises.push(new Promise((resolve, reject) => {
            window.abwa.storageManager.client.deleteAnnotation(annotationsToDelete[i], (err) => {
              if (err) {
                reject(new Error('Unable to delete annotation id: ' + annotationsToDelete[i]))
              } else {
                resolve()
              }
            })
            return true
          }))
        }
        // When all the annotations are deleted
        Promise.all(promises).catch(() => {
          Alerts.errorAlert({ text: 'There was an error when trying to delete all the annotations for this tag, please reload and try it again.' })
        }).then(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      }
    })
  }

  destroyContextMenus () {
    let arrayOfTagGroups = _.values(window.abwa.tagManager.currentTags)
    arrayOfTagGroups.forEach(tagGroup => {
      let selector = '[data-mark="' + tagGroup.config.name + '"]'
      if (selector) {
        $.contextMenu('destroy', selector)
      }
    })
  }

  initContextMenu () {
    this.destroyContextMenus()
    this.initContextMenuForCriteria()
    this.initContextMenuForCriteriaGroups()
  }

  initContextMenuForCriteriaGroups () {
    let items = {}
    // Modify menu element
    items['annotate'] = { name: 'Annotate all in one go' }
    // If custom criteria, it is also possible to delete it
    $.contextMenu({
      selector: '.tagGroup[data-group-name]',
      build: () => {
        return {
          callback: (key, ev) => {
            let criteriaGroupName = ev.$trigger.attr('data-group-name')
            if (key === 'annotate') {
              // TODO
              if (criteriaGroupName === 'Premises') {
                this.annotateAllPremises(criteriaGroupName)
              } else {
                this.formulateAllCriticalQuestions(criteriaGroupName)
              }
            }
          },
          items: items
        }
      }
    })
  }

  initContextMenuForCriteria () {
    // Define context menu items
    let arrayOfTagGroups = _.values(window.abwa.tagManager.currentTags)
    for (let i = 0; i < arrayOfTagGroups.length; i++) {
      let tagGroup = arrayOfTagGroups[i]
      let criterion = tagGroup.config.name
      let description = tagGroup.config.options.description
      let items = {}
      if (tagGroup.config.options.group === 'Premises') {
        // Highlight criterion by LLM
        items['annotatePremise'] = { name: 'State premise with annotation' }
        // Find alternative viewpoints by LLM
        items['recap'] = { name: 'Show analysis' }
      } else if (tagGroup.config.options.group === 'Critical questions') {
        // Highlight criterion by LLM
        items['annotateCriticalQuestion'] = { name: 'Formulate question' }
        items['arguments'] = { name: 'Arguments & Counter-Arguments' }
        items['recap'] = { name: 'Show analysis' }
      }
      $.contextMenu({
        selector: '[data-mark="' + tagGroup.config.name + '"]',
        build: () => {
          return {
            callback: (key) => {
              // Get latest version of tag
              let currentTagGroup = _.find(window.abwa.tagManager.currentTags, currentTag => currentTag.config.annotation.id === tagGroup.config.annotation.id)
              if (key === 'compile') {
                this.getParagraphs(criterion, (paragraphs) => {
                  if (paragraphs) {
                    CustomCriteriasManager.compile(criterion, description, paragraphs, currentTagGroup.config.annotation)
                  } else {
                    Alerts.errorAlert({
                      title: 'There are not annotations',
                      text: 'Please, annotate some paragraphs to assess the ' + criterion + ' criterion'
                    })
                  }
                })
              } else if (key === 'arguments') {
                this.getParagraphs(criterion, (paragraphs) => {
                  if (paragraphs) {
                    CustomCriteriasManager.arguments(criterion, description, paragraphs, currentTagGroup.config.annotation)
                  } else {
                    Alerts.errorAlert({
                      title: 'There are not annotations',
                      text: 'Please, highlight some paragraphs to assess the ' + criterion
                    })
                  }
                })
              } else if (key === 'recap') {
                CustomCriteriasManager.recap(currentTagGroup)
              } else if (key === 'annotatePremise') {
                if (currentTagGroup.config.name === 'Conclusion') {
                  // Find conclusion tag and if it has a statement
                  let majorTag = _.find(window.abwa.tagManager.currentTags, currentTag => currentTag.config.name === 'Major')
                  let currentMajorPremise
                  if (majorTag.config.options.compile === '') {
                    Alerts.errorAlert({
                      title: 'You do not have set the major premise',
                      text: 'Please, retrieve the major premise to draw the conclusion.'
                    })
                  } else if (majorTag.config.options.compile) {
                    currentMajorPremise = majorTag.config.options.compile.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
                    if (currentMajorPremise) {
                      this.annotatePremise(criterion, description, currentTagGroup.config.annotation)
                    } else {
                      Alerts.errorAlert({
                        title: 'You do not have a conclusion',
                        text: 'Please, retrieve the major premise to draw the conclusion.'
                      })
                    }
                  }
                } else {
                  this.getParagraphs(criterion, (paragraphs) => {
                    this.annotatePremise(criterion, description, currentTagGroup.config.annotation, paragraphs)
                  })
                }
              } else if (key === 'annotateCriticalQuestion') {
                // Find conclusion tag and if it has a statement
                let conclusionTag = _.find(window.abwa.tagManager.currentTags, currentTag => currentTag.config.name === 'Conclusion')
                let currentConclusion
                if (conclusionTag.config.options.compile === '') {
                  Alerts.errorAlert({
                    title: 'You do not have a conclusion',
                    text: 'Please, retrieve a conclusion to formulate a critical question.'
                  })
                } else if (conclusionTag.config.options.compile) {
                  currentConclusion = conclusionTag.config.options.compile.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
                  if (currentConclusion) {
                    this.getParagraphs(criterion, (paragraphs) => {
                      this.formulateCriticalQuestion(criterion, description, currentTagGroup.config.annotation, paragraphs)
                    })
                  } else {
                    Alerts.errorAlert({
                      title: 'You do not have a conclusion',
                      text: 'Please, retrieve a conclusion to formulate a critical question.'
                    })
                  }
                }
              }
            },
            items: items
          }
        }
      })
    }
  }

  static showParagraph (annotation, criterion) {
    if (annotation) {
      Alerts.infoAlert({
        title: 'The LLM suggests this information for ' + criterion + ' answering ' + annotation.question,
        text: annotation.paragraph + '<br/><br/>' + ' that justifies ' + annotation.text,
        confirmButtonText: 'OK',
        showCancelButton: false
      })
    }
  }

  static showAnnotatedParagraph (annotation, criterion) {
    if (annotation) {
      Alerts.infoAlert({
        title: 'The LLM suggests this information for ' + criterion + ' answering ' + annotation.question,
        text: annotation.paragraph + '<br/><br/>' + ' that justifies ' + annotation.text,
        confirmButtonText: 'OK',
        showCancelButton: false
      })
    }
  }

  static provideFeedback (tagGroup, feedback) {
    console.log('provideFeedback')
    if (feedback) {
      CustomCriteriasManager.editFeedback(tagGroup, feedback)
      // You can perform further actions with the found rating here
    } else {
      CustomCriteriasManager.newFeedback(tagGroup)
    }
  }

  static newFeedback (tagGroup) {
    let comment
    let rate
    let annotation = tagGroup.config.annotation
    let html =
      '<span style="text-align: left;">Comment</span>' +
      '<textarea id="userAnnotation" class="swal2-input customizeInput" placeholder="Provide your feedback"></textarea>' +
      '</div>'
    html += '<span style="text-align:left">Rating (0 Stronly disagree - 4 Strongly agree):</span><input type="number" min="0" max="4" id="ratingValue" class="swal2-input customizeInput" placeholder="Rate the answer"></input></div>'
    Alerts.feedbackAlert({
      title: 'Providing feedback for ' + tagGroup.config.name,
      html: html,
      showDenyButton: false,
      willOpen: () => {
        let element = document.querySelector('.swal2-popup')
        element.style.width = '900px'
      },
      preConfirm: () => {
        // Retrieve values from inputs
        comment = document.getElementById('userAnnotation').value
        rate = document.getElementById('ratingValue').value
        if (!rate) {
          // Throw an error or reject a promise to prevent closing the alert
          const swal = require('sweetalert2')
          swal.showValidationMessage('Please provide a rating.') // This will display an error message in the SweetAlert
          return false // Prevents the alert from closing
        } else if (rate < 0 || rate > 4) {
          const swal = require('sweetalert2')
          swal.showValidationMessage('Please provide a rating between 1 and 5.') // This will display an error message in the SweetAlert
          return false // Prevents the alert from closing
        }
        if (!comment) {
          // Throw an error or reject a promise to prevent closing the alert
          const swal = require('sweetalert2')
          swal.showValidationMessage('Please provide a comment.') // This will display an error message in the SweetAlert
          return false // Prevents the alert from closing
        }
      },
      callback: () => {
        let data
        if (annotation.text) {
          data = jsYaml.load(annotation.text)
          // Check if data.resume exists and is an array. If not, initialize it as an empty array.
          if (!Array.isArray(data.feedback)) {
            data.feedback = []
          }
          // Now that we're sure data.resume is an array, push the new object into it.
          data.feedback.push({ document: window.abwa.contentTypeManager.pdfFingerprint, comment: comment, rate: rate })
        }
        annotation.text = jsYaml.dump(data)
        LanguageUtils.dispatchCustomEvent(Events.updateTagAnnotation, {annotation: annotation})
        Alerts.successAlert({title: 'Saved', text: 'Feedback saved successfully'})
      }
    })
  }

  static editFeedback (tagGroup, feedback) {
    let comment = feedback.comment
    let rate = feedback.rate
    let annotation = tagGroup.config.annotation
    let html =
      '<span style="text-align: left;">Comment</span>' +
      '<textarea id="userAnnotation" class="swal2-input customizeInput" placeholder="Provide your feedback">' + comment + '</textarea>' +
      '</div>'
    html += '<span style="text-align:left">Rating (0 Stronly disagree - 4 Strongly agree):</span><input type="number" min="0" max="4" id="ratingValue" class="swal2-input customizeInput" placeholder="Rate the answer" value="' + rate + '"></input></div>'
    Alerts.feedbackAlert({
      title: 'Editing feedback for ' + tagGroup.config.name,
      html: html,
      preConfirm: () => {
        // Retrieve values from inputs
        comment = document.getElementById('userAnnotation').value
        rate = document.getElementById('ratingValue').value
        if (!rate) {
          // Throw an error or reject a promise to prevent closing the alert
          const swal = require('sweetalert2')
          swal.showValidationMessage('Please provide a rating.') // This will display an error message in the SweetAlert
          return false // Prevents the alert from closing
        } else if (rate < 0 || rate > 4) {
          const swal = require('sweetalert2')
          swal.showValidationMessage('Please provide a rating between 1 and 5.') // This will display an error message in the SweetAlert
          return false // Prevents the alert from closing
        }
        if (!comment) {
          // Throw an error or reject a promise to prevent closing the alert
          const swal = require('sweetalert2')
          swal.showValidationMessage('Please provide a comment.') // This will display an error message in the SweetAlert
          return false // Prevents the alert from closing
        }
      },
      willOpen: () => {
        let element = document.querySelector('.swal2-popup')
        element.style.width = '900px'
      },
      callback: () => {
        // Save model
        let data
        if (annotation.text) {
          data = jsYaml.load(annotation.text)
          // Check if data.resume exists and is an array. If not, initialize it as an empty array.
          if (!Array.isArray(data.feedback)) {
            data.feedback = []
          }
          // Now that we're sure data.resume is an array, push the new object into it.
          data.feedback.push({ document: window.abwa.contentTypeManager.pdfFingerprint, comment: comment, rate: rate })
        }
        annotation.text = jsYaml.dump(data)
        LanguageUtils.dispatchCustomEvent(Events.updateTagAnnotation, {annotation: annotation})
        Alerts.successAlert({title: 'Saved', text: 'Feedback saved successfully'})
      }
    })
  }

  static deleteCriteriaHandler (tagGroup) {
    window.abwa.sidebar.closeSidebar()
    // Ask user if they are sure to delete the current tag
    Alerts.confirmAlert({
      alertType: Alerts.alertType.warning,
      title: chrome.i18n.getMessage('DeleteCriteriaConfirmationTitle'),
      text: chrome.i18n.getMessage('DeleteCriteriaConfirmationMessage'),
      callback: (err, toDelete) => {
        // It is run only when the user confirms the dialog, so delete all the annotations
        if (err) {
          // Nothing to do
        } else {
          CustomCriteriasManager.deleteTag(tagGroup, () => {
            window.abwa.tagManager.reloadTags(() => {
              window.abwa.contentAnnotator.updateAllAnnotations(() => {
                window.abwa.sidebar.openSidebar()
              })
            })
          })
        }
      }
    })
  }

  static modifyCriteriaHandler (tagGroup, defaultNameValue = null, defaultDescriptionValue = null, defaultFullQuestion = null) {
    // let criteriaName
    // let criteriaDescription
    let formCriteriaNameValue = defaultNameValue || tagGroup.config.name
    let formCriteriaNameValueForm
    if (formCriteriaNameValue.includes('CQ')) {
      formCriteriaNameValueForm = 'critical question'
    } else {
      formCriteriaNameValueForm = formCriteriaNameValue + ' premise'
    }
    let formCriteriaDescriptionValue = defaultDescriptionValue || tagGroup.config.options.description
    let fullQuestion = defaultFullQuestion || tagGroup.config.options.fullQuestion || ''
    if (Array.isArray(fullQuestion)) {
      fullQuestion = fullQuestion.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
      if (fullQuestion) {
        fullQuestion = fullQuestion.fullQuestion
      } else {
        fullQuestion = ''
      }
    }
    // let custom = tagGroup.config.options.custom || false
    let html = '<div>' +
      '<span style="text-align: left;">Name</span>' +
      '<input readonly id="criteriaName" class="swal2-input customizeInput" value="' + formCriteriaNameValue + '"/>' +
      '</span>' +
      '<div>' +
      '<span style="text-align: left;">Description</span>' +
      '<textarea readonly id="criteriaDescription" class="swal2-input customizeInput" placeholder="Description">' + formCriteriaDescriptionValue + '</textarea>' +
      '</div>'
    if (tagGroup.config.options.group === 'Critical questions') {
      html += '<span style="text-align:left">Instantiation</span><textarea readonly id="fullQuestion" class="swal2-input customizeInput" placeholder="Formulated question">' + fullQuestion + '</textarea></div>'
    }
    Alerts.threeOptionsAlert({
      title: 'Values for ' + formCriteriaNameValueForm,
      html: html,
      showCancelButton: true,
      showDenyButton: false,
      confirmButtonText: 'OK',
      cancelButtonText: 'Restore',
      cancelButtonColor: '#f6583c',
      cancelCallback: () => {
        // Restore
        CustomCriteriasManager.restoreTag(tagGroup, (annotation) => {
          console.log('Restored' + annotation)
          window.abwa.tagManager.reloadTags(() => {
            window.abwa.contentAnnotator.updateAllAnnotations(() => {
              window.abwa.sidebar.openSidebar()
            })
          })
        })
      }
    })
  }

  static modifyCriteria ({ tagGroup, name, description, fullQuestion, custom = true, group, callback }) {
    // Check if name has changed
    let data = tagGroup.config.options
    if (name === tagGroup.config.name || _.isUndefined(name)) {
      // Check if description has changed
      if ((description !== data.description || _.isUndefined(description)) || (fullQuestion !== data.fullQuestion || _.isUndefined(fullQuestion))) {
        name = name || tagGroup.config.name
        description = description || data.description
        let fullQuestionObject
        if (_.isUndefined(fullQuestion)) {
          console.log('fullQuestion is not updated')
          if (data.fullQuestion) {
            fullQuestionObject = data.fullQuestion
          } else {
            fullQuestionObject = []
          }
        } else {
          if (!Array.isArray(data.fullQuestion)) {
            fullQuestionObject = []
            fullQuestionObject.push({ document: window.abwa.contentTypeManager.pdfFingerprint, fullQuestion: fullQuestion })
          } else {
            fullQuestionObject = data.fullQuestion
            let foundFullQuestion = fullQuestionObject.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
            if (!foundFullQuestion) {
              // If not, create and add it to the array
              fullQuestionObject.push({ document: window.abwa.contentTypeManager.pdfFingerprint, fullQuestion: fullQuestion })
            } else {
              foundFullQuestion.fullQuestion = fullQuestion
            }
          }
        }
        // Update annotation description
        let oldAnnotation = tagGroup.config.annotation
        // Create new annotation
        let review = new Review({ reviewId: '' })
        review.storageGroup = window.abwa.groupSelector.currentGroup
        let criteria = new Criteria({
          name: name,
          description: description,
          fullQuestion: fullQuestionObject,
          group: group || tagGroup.config.options.group,
          review,
          custom: custom
        })
        let annotation = criteria.toAnnotation()
        window.abwa.storageManager.client.updateAnnotation(oldAnnotation.id, annotation, (err, annotation) => {
          if (err) {
            // TODO Show err
            if (_.isFunction(callback)) {
              callback(err)
            }
          } else {
            if (_.isFunction(callback)) {
              callback()
            }
          }
        })
      }
    } else {
      // If name has changed, check if there is not other criteria with the same value
      if (CustomCriteriasManager.alreadyExistsThisCriteriaName(name)) {
        // Alert already exists
        Alerts.errorAlert({
          title: 'Criteria already exists',
          text: 'A criteria with the name ' + name + ' already exists.',
          callback: () => {
            this.modifyCriteriaHandler(tagGroup, name, description)
          }
        })
      } else {
        // Update all annotations review:isCriteriaOf:
        window.abwa.storageManager.client.searchAnnotations({
          tags: Config.review.namespace + ':' + Config.review.tags.grouped.relation + ':' + tagGroup.config.name
        }, (err, annotationsToUpdateTag) => {
          if (err) {
            // Unable to update
            Alerts.errorAlert({ text: 'Unable to update criteria.' })
          } else {
            let oldTag = Config.review.namespace + ':' + Config.review.tags.grouped.relation + ':' + tagGroup.config.name
            let newTag = Config.review.namespace + ':' + Config.review.tags.grouped.relation + ':' + name
            // Update annotations tag
            annotationsToUpdateTag = _.map(annotationsToUpdateTag, (annotation) => {
              // Change isCriteriOf tag with the new one
              return AnnotationUtils.modifyTag(annotation, oldTag, newTag)
            })
            // Update all annotations
            let promises = []
            for (let i = 0; i < annotationsToUpdateTag.length; i++) {
              promises.push(new Promise((resolve, reject) => {
                window.abwa.storageManager.client.updateAnnotation(annotationsToUpdateTag[i].id, annotationsToUpdateTag[i], (err, annotation) => {
                  if (err) {
                    reject(err)
                  } else {
                    resolve(annotation)
                  }
                })
              }))
            }
            Promise.all(promises).catch(() => {
              // TODO Some annotations where unable to update
            }).then(() => {
              // Update tagGroup annotation
              let review = new Review({ reviewId: '' })
              review.storageGroup = window.abwa.groupSelector.currentGroup
              let criteria = new Criteria({
                name,
                description,
                fullQuestion,
                group: tagGroup.config.options.group,
                review,
                custom: custom
              })
              let annotation = criteria.toAnnotation()
              let oldAnnotation = tagGroup.config.annotation
              window.abwa.storageManager.client.updateAnnotation(oldAnnotation.id, annotation, (err, annotation) => {
                if (err) {
                  Alerts.errorAlert({ text: 'Unable to update criteria. Error: ' + err.message })
                } else {
                  if (_.isFunction(callback)) {
                    callback()
                  }
                }
              })
            })
          }
        })
      }
    }
  }

  annotatePremise (criterion, description, tagAnnotation, paragraphs) {
    let data = tagAnnotation.text
    let findFeedback
    if (data) {
      data = jsYaml.load(data)
      if (data.feedback) {
        findFeedback = data.feedback.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
      }
    }
    if (findFeedback) {
      this.annotatePremiseWithFeedback(criterion, description, tagAnnotation, findFeedback, data, paragraphs)
    } else {
      // this.modifyCriteriaHandler(currentTagGroup)
      chrome.runtime.sendMessage({ scope: 'llm', cmd: 'getSelectedLLM' }, async ({ llm }) => {
        if (llm === '') {
          llm = Config.review.defaultLLM
        }
        if (llm && llm !== '') {
          let selectedLLM = llm.modelType
          Alerts.confirmAlert({
            title: 'Find annotations for ' + criterion + ' premise',
            text: 'Do you want to state the premises using LLM?',
            cancelButtonText: 'Cancel',
            callback: async () => {
              let documents = []
              documents = await LLMTextUtils.loadDocument()
              chrome.runtime.sendMessage({
                scope: 'llm',
                cmd: 'getAPIKEY',
                data: selectedLLM
              }, ({ apiKey }) => {
                let callback = (json) => {
                  let excerpt = json.excerpt
                  let statement = json.statement
                  let selectors = this.getSelectorsFromLLM(excerpt, documents)
                  let annotation = {
                    paragraph: excerpt,
                    text: statement,
                    selectors: selectors
                  }
                  if (selectors.length > 0) {
                    let commentData = {
                      comment: '',
                      statement: statement,
                      llm: llm,
                      paragraph: excerpt
                    }
                    let model = window.abwa.tagManager.model
                    let tag = [
                      model.namespace + ':' + model.config.grouped.relation + ':' + criterion
                    ]
                    CustomCriteriasManager.deleteTagAnnotations(tag, () => {
                      LanguageUtils.dispatchCustomEvent(Events.annotateByLLM, {
                        tags: tag,
                        selectors: selectors,
                        commentData: commentData
                      })
                    })
                  }
                  if (annotation.selectors.length === 0) {
                    CustomCriteriasManager.showParagraph(annotation, criterion)
                  } else {
                    CustomCriteriasManager.showAnnotatedParagraph(annotation, criterion)
                  }
                  // retrieve tag annotation
                  let data
                  if (tagAnnotation.text) {
                    data = jsYaml.load(tagAnnotation.text)
                    // Check if data.resume exists and is an array. If not, initialize it as an empty array.
                    data.compile = []
                    // Now that we're sure data.resume is an array, push the new object into it.
                    data.compile.push({ document: window.abwa.contentTypeManager.pdfFingerprint, answer: statement })
                  }
                  tagAnnotation.text = jsYaml.dump(data)
                  LanguageUtils.dispatchCustomEvent(Events.updateTagAnnotation, {annotation: tagAnnotation})
                  Alerts.successAlert({title: 'Saved', text: 'The text has been saved in the report'})
                }
                if (apiKey && apiKey !== '') {
                  chrome.runtime.sendMessage({ scope: 'prompt', cmd: 'getPrompt', data: {type: 'annotatePremisePrompt'} }, ({ prompt }) => {
                    if (!prompt) {
                      prompt = Config.prompts.annotatePremisePrompt
                    }
                    let scheme = ''
                    if (window.abwa.tagManager) {
                      let currentTags = window.abwa.tagManager.currentTags
                      // Retrieve Premises
                      let premises = currentTags.filter(tag => {
                        return tag.config.options.group === 'Premises'
                      })
                      let conclusion
                      for (let i = 0; i < premises.length; i++) {
                        const premise = premises[i]
                        if (premise.config.name === 'Conclusion') {
                          conclusion = premise
                        } else {
                          scheme += premise.config.name.toUpperCase() + ' PREMISE: '
                          scheme += premise.config.options.description + '\n'
                        }
                      }
                      scheme += conclusion.config.name.toUpperCase() + ': '
                      scheme += conclusion.config.options.description + '\n'
                    }
                    prompt = prompt.replaceAll('[C_DESCRIPTION]', description).replaceAll('[C_NAME]', criterion).replaceAll('[C_SCHEME]', scheme)
                    let params = {
                      prompt: prompt,
                      llm: llm,
                      apiKey: apiKey,
                      documents: documents,
                      callback: callback
                    }
                    LLMClient.pdfBasedQuestion(params)
                  })
                } else {
                  let callback = () => {
                    window.open(chrome.runtime.getURL('pages/options.html'))
                  }
                  Alerts.infoAlert({
                    text: 'Please, configure your LLM.',
                    title: 'Please select a LLM and provide your API key',
                    callback: callback()
                  })
                }
              })
            }
          })
        }
      })
    }
  }

  annotatePremiseWithFeedback (criterion, description, tagAnnotation, feedback, previousAnswer, paragraphs) {
    chrome.runtime.sendMessage({ scope: 'llm', cmd: 'getSelectedLLM' }, async ({ llm }) => {
      if (llm === '') {
        llm = Config.review.defaultLLM
      }
      if (llm && llm !== '') {
        let selectedLLM = llm.modelType
        Alerts.confirmAlert({
          title: 'Find annotations for ' + criterion + ' premise',
          text: 'Do you want to state the premises using LLM?',
          cancelButtonText: 'Cancel',
          callback: () => {
            Alerts.confirmAlert({
              title: 'Use you feedback',
              text: 'Do you want to use your feedback to annotate the premise?',
              cancelButtonText: 'No',
              confirmButtonText: 'Yes',
              showCancelButton: true,
              // eslint-disable-next-line handle-callback-err
              callback: async (err, addFeedback) => {
                console.log(addFeedback)
                let documents = []
                documents = await LLMTextUtils.loadDocument()
                chrome.runtime.sendMessage({
                  scope: 'llm',
                  cmd: 'getAPIKEY',
                  data: selectedLLM
                }, ({ apiKey }) => {
                  let callback = (json) => {
                    let excerpt = json.excerpt
                    let statement = json.statement
                    let selectors = this.getSelectorsFromLLM(excerpt, documents)
                    let annotation = {
                      paragraph: excerpt,
                      text: statement,
                      selectors: selectors
                    }
                    if (selectors.length > 0) {
                      let commentData = {
                        comment: '',
                        statement: statement,
                        llm: llm,
                        paragraph: excerpt
                      }
                      let model = window.abwa.tagManager.model
                      let tag = [
                        model.namespace + ':' + model.config.grouped.relation + ':' + criterion
                      ]
                      CustomCriteriasManager.deleteTagAnnotations(tag, () => {
                        LanguageUtils.dispatchCustomEvent(Events.annotateByLLM, {
                          tags: tag,
                          selectors: selectors,
                          commentData: commentData
                        })
                      })
                    }
                    if (annotation.selectors.length === 0) {
                      CustomCriteriasManager.showParagraph(annotation, criterion)
                    } else {
                      CustomCriteriasManager.showAnnotatedParagraph(annotation, criterion)
                    }
                    // retrieve tag annotation
                    let data
                    if (tagAnnotation.text) {
                      data = jsYaml.load(tagAnnotation.text)
                      // Check if data.resume exists and is an array. If not, initialize it as an empty array.
                      data.compile = []
                      // Now that we're sure data.resume is an array, push the new object into it.
                      data.compile.push({ document: window.abwa.contentTypeManager.pdfFingerprint, answer: statement })
                      data.feedback = ''
                    }
                    tagAnnotation.text = jsYaml.dump(data)
                    LanguageUtils.dispatchCustomEvent(Events.updateTagAnnotation, {annotation: tagAnnotation})
                    Alerts.successAlert({title: 'Saved', text: 'The text has been saved in the report'})
                  }
                  if (apiKey && apiKey !== '') {
                    chrome.runtime.sendMessage({ scope: 'prompt', cmd: 'getPrompt', data: {type: 'annotatePremisePrompt'} }, ({ prompt }) => {
                      if (!prompt) {
                        prompt = Config.prompts.annotatePremisePrompt
                      }
                      let scheme = ''
                      if (window.abwa.tagManager) {
                        let currentTags = window.abwa.tagManager.currentTags
                        // Retrieve Premises
                        let premises = currentTags.filter(tag => {
                          return tag.config.options.group === 'Premises'
                        })
                        let conclusion
                        for (let i = 0; i < premises.length; i++) {
                          const premise = premises[i]
                          if (premise.config.name === 'Conclusion') {
                            conclusion = premise
                          } else {
                            scheme += premise.config.name.toUpperCase() + ' PREMISE: '
                            scheme += premise.config.options.description + '\n'
                          }
                        }
                        scheme += conclusion.config.name.toUpperCase() + ': '
                        scheme += conclusion.config.options.description + '\n'
                      }
                      prompt = prompt.replaceAll('[C_DESCRIPTION]', description).replaceAll('[C_NAME]', criterion).replaceAll('[C_SCHEME]', scheme)
                      if (addFeedback) {
                        let findStatement = previousAnswer.compile.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
                        prompt = prompt + '\n\nYour previous answer for this same prompt has been: \n'
                        prompt = prompt + '"statement":' + findStatement.answer + '\n'
                        prompt = prompt + '"excerpt":' + paragraphs.replaceAll('paragraph1:', '') + '\n'
                        prompt = prompt + 'Please, now consider the following feedback for improving your answer.\n'
                        prompt = prompt + '\n\nFeedback for your previous answer: ' + feedback.comment + '\nRating of your previous answer from 0 to 4: ' + feedback.rate
                      }
                      let params = {
                        prompt: prompt,
                        llm: llm,
                        apiKey: apiKey,
                        documents: documents,
                        callback: callback
                      }
                      LLMClient.pdfBasedQuestion(params)
                    })
                  } else {
                    let callback = () => {
                      window.open(chrome.runtime.getURL('pages/options.html'))
                    }
                    Alerts.infoAlert({
                      text: 'Please, configure your LLM.',
                      title: 'Please select a LLM and provide your API key',
                      callback: callback()
                    })
                  }
                })
              }
            })
          }
        })
      }
    })
  }

  annotateAllPremises () {
    chrome.runtime.sendMessage({ scope: 'llm', cmd: 'getSelectedLLM' }, async ({ llm }) => {
      if (llm === '') {
        llm = Config.review.defaultLLM
      }
      if (llm && llm !== '') {
        let selectedLLM = llm.modelType
        Alerts.confirmAlert({
          title: 'Find annotations for premises',
          text: 'Do you want to state the premises using LLM?',
          cancelButtonText: 'Cancel',
          callback: async () => {
            let documents = []
            documents = await LLMTextUtils.loadDocument()
            chrome.runtime.sendMessage({
              scope: 'llm',
              cmd: 'getAPIKEY',
              data: selectedLLM
            }, ({ apiKey }) => {
              let callback = (json) => {
                let answers = this.parseAllPremisesAnswer(json)
                let tagAnnotations = []
                if (answers.length > 0) {
                  answers.forEach(answer => {
                    let excerpt = answer.excerpt
                    let statement = answer.statement
                    let selectors = this.getSelectorsFromLLM(excerpt, documents)
                    if (selectors.length > 0) {
                      let commentData = {
                        comment: '',
                        statement: statement,
                        llm: llm,
                        paragraph: excerpt
                      }
                      let model = window.abwa.tagManager.model
                      let tag = [
                        model.namespace + ':' + model.config.grouped.relation + ':' + answer.name
                      ]
                      CustomCriteriasManager.deleteTagAnnotations(tag, () => {
                        LanguageUtils.dispatchCustomEvent(Events.annotateByLLM, {
                          tags: tag,
                          selectors: selectors,
                          commentData: commentData
                        })
                      })
                    }
                    // retrieve tag annotation
                    let data
                    let currentTagGroup = _.find(window.abwa.tagManager.currentTags, currentTag => currentTag.config.name === answer.name)
                    let tagAnnotation = currentTagGroup.config.annotation
                    if (tagAnnotation.text) {
                      data = jsYaml.load(tagAnnotation.text)
                      // Check if data.resume exists and is an array. If not, initialize it as an empty array.
                      data.compile = []
                      // Now that we're sure data.resume is an array, push the new object into it.
                      data.compile.push({ document: window.abwa.contentTypeManager.pdfFingerprint, answer: statement })
                    }
                    tagAnnotation.text = jsYaml.dump(data)
                    tagAnnotations.push(tagAnnotation)
                  })
                }
                LanguageUtils.dispatchCustomEvent(Events.updateTagAnnotations, {annotations: tagAnnotations})
                Alerts.successAlert({title: 'Available analysis', text: 'Critical questions completed'})
              }
              if (apiKey && apiKey !== '') {
                chrome.runtime.sendMessage({ scope: 'prompt', cmd: 'getPrompt', data: {type: 'annotatePremisePrompt'} }, ({ prompt }) => {
                  if (!prompt) {
                    prompt = Config.prompts.annotateAllPremisesPrompt
                  }
                  let scheme = ''
                  let format = ''
                  if (window.abwa.tagManager) {
                    let currentTags = window.abwa.tagManager.currentTags
                    // Retrieve Premises
                    let premises = currentTags.filter(tag => {
                      return tag.config.options.group === 'Premises'
                    })
                    let conclusion
                    for (let i = 0; i < premises.length; i++) {
                      const premise = premises[i]
                      if (premise.config.name === 'Conclusion') {
                        conclusion = premise
                      } else {
                        scheme += premise.config.name.toUpperCase() + ' PREMISE: '
                        scheme += premise.config.options.description + '\n'
                      }
                    }
                    scheme += conclusion.config.name.toUpperCase() + ': '
                    scheme += conclusion.config.options.description + '\n'
                    // FORMAT
                    format += '{\n' + '"items": ['
                    for (let i = 0; i < premises.length; i++) {
                      if (i === 0) {
                        format += '{"name":"' + premises[i].config.name + '",' +
                          '"statement": "Statement of the premise based on the description, you have to rewrite it to the case in hand, for example you have to provide the values for the v, alpha, s, Agents and claims",\n' +
                          '"excerpt": "Excerpt from the story that justifies the statement of the premise",\n' +
                          '}'
                      } else {
                        format += ',{"name":"' + premises[i].config.name + '",' +
                          '"statement": "Statement of the premise based on the description, you have to rewrite it to the case in hand, for example you have to provide the values for the v, alpha, s, Agents and claims",\n' +
                          '"excerpt": "Excerpt from the story that justifies the statement of the premise",\n' +
                          '}'
                      }
                    }
                    //
                  }
                  prompt = prompt.replaceAll('[C_SCHEME]', scheme).replaceAll('[C_FORMAT]', format)
                  let params = {
                    prompt: prompt,
                    llm: llm,
                    apiKey: apiKey,
                    documents: documents,
                    callback: callback
                  }
                  LLMClient.pdfBasedQuestion(params)
                })
              } else {
                let callback = () => {
                  window.open(chrome.runtime.getURL('pages/options.html'))
                }
                Alerts.infoAlert({
                  text: 'Please, configure your LLM.',
                  title: 'Please select a LLM and provide your API key',
                  callback: callback()
                })
              }
            })
          }
        })
      }
    })
  }

  formulateCriticalQuestion (criterion, description, tagAnnotation, paragraphs) {
    let data = tagAnnotation.text
    let findFeedback
    if (data) {
      data = jsYaml.load(data)
      if (data.feedback) {
        findFeedback = data.feedback.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
      }
    }
    if (findFeedback) {
      this.formulateCriticalQuestionWithFeedback(criterion, description, tagAnnotation, findFeedback, data, paragraphs)
    } else {
      // this.modifyCriteriaHandler(currentTagGroup)
      chrome.runtime.sendMessage({ scope: 'llm', cmd: 'getSelectedLLM' }, async ({ llm }) => {
        if (llm === '') {
          llm = Config.review.defaultLLM
        }
        if (llm && llm !== '') {
          let selectedLLM = llm.modelType
          Alerts.confirmAlert({
            title: 'Formulate ' + criterion,
            text: 'Do you want to answer the critical question using LLM?',
            cancelButtonText: 'Cancel',
            callback: async () => {
              let documents = []
              documents = await LLMTextUtils.loadDocument()
              chrome.runtime.sendMessage({
                scope: 'llm',
                cmd: 'getAPIKEY',
                data: selectedLLM
              }, ({ apiKey }) => {
                let callback = (json) => {
                  let excerpt = json.excerpt
                  let question = json.adaptedQuestion
                  let answer = json.answer
                  let selectors = this.getSelectorsFromLLM(excerpt, documents)
                  let annotation = {
                    paragraph: excerpt,
                    text: answer,
                    question: question,
                    selectors: selectors
                  }
                  if (selectors.length > 0) {
                    let commentData = {
                      comment: '',
                      statement: answer,
                      llm: llm,
                      paragraph: excerpt
                    }
                    let model = window.abwa.tagManager.model
                    let tag = [
                      model.namespace + ':' + model.config.grouped.relation + ':' + criterion
                    ]
                    CustomCriteriasManager.deleteTagAnnotations(tag, () => {
                      LanguageUtils.dispatchCustomEvent(Events.annotateByLLM, {
                        tags: tag,
                        selectors: selectors,
                        commentData: commentData
                      })
                    })
                  }
                  if (annotation.selectors.length === 0) {
                    CustomCriteriasManager.showParagraph(annotation, criterion)
                  } else {
                    CustomCriteriasManager.showAnnotatedParagraph(annotation, criterion)
                  }
                  // retrieve tag annotation
                  let data
                  if (tagAnnotation.text) {
                    data = jsYaml.load(tagAnnotation.text)
                    // Check if data.resume exists and is an array. If not, initialize it as an empty array.
                    if (!Array.isArray(data.compile)) {
                      data.compile = []
                    }
                    let foundCompile = data.compile.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
                    if (!foundCompile) {
                      // If not, create and add it to the array
                      data.compile.push({ document: window.abwa.contentTypeManager.pdfFingerprint, answer: answer })
                    } else {
                      foundCompile.answer = answer
                    }
                    if (!Array.isArray(data.fullQuestion)) {
                      data.fullQuestion = []
                    }
                    let foundFullQuestion = data.fullQuestion.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
                    if (!foundFullQuestion) {
                      // If not, create and add it to the array
                      data.fullQuestion.push({ document: window.abwa.contentTypeManager.pdfFingerprint, fullQuestion: question })
                    } else {
                      foundFullQuestion.fullQuestion = question
                    }
                  }
                  tagAnnotation.text = jsYaml.dump(data)
                  LanguageUtils.dispatchCustomEvent(Events.updateTagAnnotation, {annotation: tagAnnotation})
                  Alerts.successAlert({title: 'Saved', text: 'The text has been saved in the report'})
                }
                if (apiKey && apiKey !== '') {
                  chrome.runtime.sendMessage({ scope: 'prompt', cmd: 'getPrompt', data: {type: 'criticalQuestionPrompt'} }, ({ prompt }) => {
                    if (!prompt) {
                      prompt = Config.prompts.criticalQuestionPrompt
                    }
                    let scheme = ''
                    if (window.abwa.tagManager) {
                      let currentTags = window.abwa.tagManager.currentTags
                      // Retrieve Premises
                      let premises = currentTags.filter(tag => {
                        return tag.config.options.group === 'Premises'
                      })
                      let conclusion
                      for (let i = 0; i < premises.length; i++) {
                        const premise = premises[i]
                        if (premise.config.name === 'Conclusion') {
                          conclusion = premise
                        } else {
                          scheme += premise.config.name.toUpperCase() + ' PREMISE: '
                          if (premise.config.options.compile.answer) {
                            scheme += premise.config.options.compile.answer + '\n'
                          } else {
                            scheme += premise.config.options.description + '\n'
                          }
                        }
                      }
                      scheme += conclusion.config.name.toUpperCase() + ': '
                      if (conclusion.config.options.compile.answer) {
                        scheme += conclusion.config.options.compile.answer + '\n'
                      } else {
                        scheme += conclusion.config.options.description + '\n'
                      }
                    }
                    prompt = prompt.replaceAll('[C_DESCRIPTION]', description).replaceAll('[C_SCHEME]', scheme)
                    let params = {
                      prompt: prompt,
                      llm: llm,
                      apiKey: apiKey,
                      documents: documents,
                      callback: callback
                    }
                    LLMClient.pdfBasedQuestion(params)
                  })
                } else {
                  let callback = () => {
                    window.open(chrome.runtime.getURL('pages/options.html'))
                  }
                  Alerts.infoAlert({
                    text: 'Please, configure your LLM.',
                    title: 'Please select a LLM and provide your API key',
                    callback: callback()
                  })
                }
              })
            }
          })
        }
      })
    }
  }

  formulateCriticalQuestionWithFeedback (criterion, description, tagAnnotation, feedback, previousAnswer, paragraphs) {
    chrome.runtime.sendMessage({ scope: 'llm', cmd: 'getSelectedLLM' }, async ({ llm }) => {
      if (llm === '') {
        llm = Config.review.defaultLLM
      }
      if (llm && llm !== '') {
        let selectedLLM = llm.modelType
        Alerts.confirmAlert({
          title: 'Formulate ' + criterion,
          text: 'Do you want to answer the critical question using LLM?',
          cancelButtonText: 'Cancel',
          callback: () => {
            Alerts.confirmAlert({
              title: 'Use you feedback',
              text: 'Do you want to use your feedback to annotate the premise?',
              cancelButtonText: 'No',
              confirmButtonText: 'Yes',
              showCancelButton: true,
              // eslint-disable-next-line handle-callback-err
              callback: async (err, addFeedback) => {
                console.log(addFeedback)
                let documents = []
                documents = await LLMTextUtils.loadDocument()
                chrome.runtime.sendMessage({
                  scope: 'llm',
                  cmd: 'getAPIKEY',
                  data: selectedLLM
                }, ({ apiKey }) => {
                  let callback = (json) => {
                    let excerpt = json.excerpt
                    let question = json.adaptedQuestion
                    let answer = json.answer
                    let selectors = this.getSelectorsFromLLM(excerpt, documents)
                    let annotation = {
                      paragraph: excerpt,
                      text: answer,
                      question: question,
                      selectors: selectors
                    }
                    if (selectors.length > 0) {
                      let commentData = {
                        comment: '',
                        statement: answer,
                        llm: llm,
                        paragraph: excerpt
                      }
                      let model = window.abwa.tagManager.model
                      let tag = [
                        model.namespace + ':' + model.config.grouped.relation + ':' + criterion
                      ]
                      CustomCriteriasManager.deleteTagAnnotations(tag, () => {
                        LanguageUtils.dispatchCustomEvent(Events.annotateByLLM, {
                          tags: tag,
                          selectors: selectors,
                          commentData: commentData
                        })
                      })
                    }
                    if (annotation.selectors.length === 0) {
                      CustomCriteriasManager.showParagraph(annotation, criterion)
                    } else {
                      CustomCriteriasManager.showAnnotatedParagraph(annotation, criterion)
                    }
                    // retrieve tag annotation
                    let data
                    if (tagAnnotation.text) {
                      data = jsYaml.load(tagAnnotation.text)
                      data.feedback = ''
                      // Check if data.resume exists and is an array. If not, initialize it as an empty array.
                      if (!Array.isArray(data.compile)) {
                        data.compile = []
                      }
                      let foundCompile = data.compile.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
                      if (!foundCompile) {
                        // If not, create and add it to the array
                        data.compile.push({ document: window.abwa.contentTypeManager.pdfFingerprint, answer: answer })
                      } else {
                        foundCompile.answer = answer
                      }
                      if (!Array.isArray(data.fullQuestion)) {
                        data.fullQuestion = []
                      }
                      let foundFullQuestion = data.fullQuestion.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
                      if (!foundFullQuestion) {
                        // If not, create and add it to the array
                        data.fullQuestion.push({
                          document: window.abwa.contentTypeManager.pdfFingerprint,
                          fullQuestion: question
                        })
                      } else {
                        foundFullQuestion.fullQuestion = question
                      }
                    }
                    tagAnnotation.text = jsYaml.dump(data)
                    LanguageUtils.dispatchCustomEvent(Events.updateTagAnnotation, { annotation: tagAnnotation })
                    Alerts.successAlert({ title: 'Saved', text: 'The text has been saved in the report' })
                  }
                  if (apiKey && apiKey !== '') {
                    chrome.runtime.sendMessage({
                      scope: 'prompt',
                      cmd: 'getPrompt',
                      data: { type: 'criticalQuestionPrompt' }
                    }, ({ prompt }) => {
                      if (!prompt) {
                        prompt = Config.prompts.criticalQuestionPrompt
                      }
                      let scheme = ''
                      if (window.abwa.tagManager) {
                        let currentTags = window.abwa.tagManager.currentTags
                        // Retrieve Premises
                        let premises = currentTags.filter(tag => {
                          return tag.config.options.group === 'Premises'
                        })
                        let conclusion
                        for (let i = 0; i < premises.length; i++) {
                          const premise = premises[i]
                          if (premise.config.name === 'Conclusion') {
                            conclusion = premise
                          } else {
                            scheme += premise.config.name.toUpperCase() + ' PREMISE: '
                            if (premise.config.options.compile.answer) {
                              scheme += premise.config.options.compile.answer + '\n'
                            } else {
                              scheme += premise.config.options.description + '\n'
                            }
                          }
                        }
                        scheme += conclusion.config.name.toUpperCase() + ': '
                        if (conclusion.config.options.compile.answer) {
                          scheme += conclusion.config.options.compile.answer + '\n'
                        } else {
                          scheme += conclusion.config.options.description + '\n'
                        }
                      }
                      prompt = prompt.replaceAll('[C_DESCRIPTION]', description).replaceAll('[C_SCHEME]', scheme)
                      if (addFeedback) {
                        let findStatement = previousAnswer.compile.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
                        let findFullQuestion = previousAnswer.fullQuestion.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
                        prompt = prompt + '\n\nYour previous answer for this same prompt has been: \n'
                        prompt = prompt + '"adaptedQuestion":' + findFullQuestion.fullQuestion + '\n'
                        prompt = prompt + '"answer":' + findStatement.answer + '\n'
                        prompt = prompt + '"excerpt":' + paragraphs.replaceAll('paragraph1:', '') + '\n'
                        prompt = prompt + 'Please, now consider the following feedback for improving your answer.\n'
                        prompt = prompt + '\n\nFeedback for your previous answer: ' + feedback.comment + '\nRating of your previous answer from 0 to 4: ' + feedback.rate
                      }
                      let params = {
                        prompt: prompt,
                        llm: llm,
                        apiKey: apiKey,
                        documents: documents,
                        callback: callback
                      }
                      LLMClient.pdfBasedQuestion(params)
                    })
                  } else {
                    let callback = () => {
                      window.open(chrome.runtime.getURL('pages/options.html'))
                    }
                    Alerts.infoAlert({
                      text: 'Please, configure your LLM.',
                      title: 'Please select a LLM and provide your API key',
                      callback: callback()
                    })
                  }
                })
              }
            })
          }
        })
      }
    })
  }

  formulateAllCriticalQuestions (groupName) {
    // this.modifyCriteriaHandler(currentTagGroup)
    chrome.runtime.sendMessage({ scope: 'llm', cmd: 'getSelectedLLM' }, async ({ llm }) => {
      if (llm === '') {
        llm = Config.review.defaultLLM
      }
      if (llm && llm !== '') {
        let selectedLLM = llm.modelType
        Alerts.confirmAlert({
          title: 'Find annotations for critical questions',
          text: 'Do you want to perform the critical questions using LLM?',
          cancelButtonText: 'Cancel',
          callback: async () => {
            let documents = []
            documents = await LLMTextUtils.loadDocument()
            chrome.runtime.sendMessage({
              scope: 'llm',
              cmd: 'getAPIKEY',
              data: selectedLLM
            }, ({ apiKey }) => {
              let callback = (json) => {
                let answers = this.parseAllCriticalQuestionsAnswer(json)
                let tagAnnotations = []
                if (answers.length > 0) {
                  answers.forEach(llmAnswer => {
                    let excerpt = llmAnswer.excerpt
                    let question = llmAnswer.adaptedQuestion
                    let answer = llmAnswer.answer
                    let selectors = this.getSelectorsFromLLM(excerpt, documents)
                    if (selectors.length > 0) {
                      let commentData = {
                        comment: '',
                        statement: answer,
                        llm: llm,
                        paragraph: excerpt
                      }
                      let model = window.abwa.tagManager.model
                      let tag = [
                        model.namespace + ':' + model.config.grouped.relation + ':' + llmAnswer.name
                      ]
                      CustomCriteriasManager.deleteTagAnnotations(tag, () => {
                        LanguageUtils.dispatchCustomEvent(Events.annotateByLLM, {
                          tags: tag,
                          selectors: selectors,
                          commentData: commentData
                        })
                      })
                    }
                    // retrieve tag annotation
                    let data
                    let currentTagGroup = _.find(window.abwa.tagManager.currentTags, currentTag => currentTag.config.name === llmAnswer.name)
                    if (currentTagGroup) {
                      let tagAnnotation = currentTagGroup.config.annotation
                      if (tagAnnotation.text) {
                        data = jsYaml.load(tagAnnotation.text)
                        // Check if data.resume exists and is an array. If not, initialize it as an empty array.
                        if (!Array.isArray(data.compile)) {
                          data.compile = []
                        }
                        let foundCompile = data.compile.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
                        if (!foundCompile) {
                          // If not, create and add it to the array
                          data.compile.push({ document: window.abwa.contentTypeManager.pdfFingerprint, answer: answer })
                        } else {
                          foundCompile.answer = answer
                        }
                        if (!Array.isArray(data.fullQuestion)) {
                          data.fullQuestion = []
                        }
                        let foundFullQuestion = data.fullQuestion.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
                        if (!foundFullQuestion) {
                          // If not, create and add it to the array
                          data.fullQuestion.push({
                            document: window.abwa.contentTypeManager.pdfFingerprint,
                            fullQuestion: question
                          })
                        } else {
                          foundFullQuestion.fullQuestion = question
                        }
                        tagAnnotation.text = jsYaml.dump(data)
                        tagAnnotations.push(tagAnnotation)
                      }
                    }
                  })
                }
                LanguageUtils.dispatchCustomEvent(Events.updateTagAnnotations, {annotations: tagAnnotations})
                Alerts.successAlert({title: 'Available analysis', text: 'Critical questions completed'})
              }
              if (apiKey && apiKey !== '') {
                chrome.runtime.sendMessage({ scope: 'prompt', cmd: 'getPrompt', data: {type: 'criticalQuestionPrompt'} }, ({ prompt }) => {
                  if (!prompt) {
                    prompt = Config.prompts.allCriticalQuestionPrompt
                  }
                  let scheme = ''
                  let format = ''
                  let questions = ''
                  if (window.abwa.tagManager) {
                    let currentTags = window.abwa.tagManager.currentTags
                    // Retrieve Premises
                    let premises = currentTags.filter(tag => {
                      return tag.config.options.group === 'Premises'
                    })
                    let conclusion
                    for (let i = 0; i < premises.length; i++) {
                      const premise = premises[i]
                      if (premise.config.name === 'Conclusion') {
                        conclusion = premise
                      } else {
                        scheme += premise.config.name.toUpperCase() + ' PREMISE: '
                        if (premise.config.options.compile.answer) {
                          scheme += premise.config.options.compile.answer + '\n'
                        } else {
                          scheme += premise.config.options.description + '\n'
                        }
                      }
                    }
                    scheme += conclusion.config.name.toUpperCase() + ': '
                    if (conclusion.config.options.compile.answer) {
                      scheme += conclusion.config.options.compile.answer + '\n'
                    } else {
                      scheme += conclusion.config.options.description + '\n'
                    }
                    // Retrieve CRITICAL QUESTIONS
                    let criticalQuestions = currentTags.filter(tag => {
                      return tag.config.options.group === 'Critical questions'
                    })
                    for (let i = 0; i < criticalQuestions.length; i++) {
                      const criticalQuestion = criticalQuestions[i]
                      questions += criticalQuestion.config.name.toUpperCase() + ': '
                      questions += criticalQuestion.config.options.description + '\n'
                    }
                    // FORMAT
                    format += '{\n' + '"items": ['
                    for (let i = 0; i < criticalQuestions.length; i++) {
                      if (i === 0) {
                        format += '{"name":"' + criticalQuestions[i].config.name + '",' +
                          '"adaptedQuestion": "the question, but rewritten with the values of the story, for example you have to provide the values for the v, alpha, s, Agents and claims",\n' +
                          '"answer": "Answer of the question based on the story and the adapted question",\n' +
                          '"excerpt": "Excerpt from the story that justifies the answer for the critical questions",\n' +
                          '}'
                      } else {
                        format += ',{"name":"' + criticalQuestions[i].config.name + '",' +
                          '"adaptedQuestion": "the question, but rewritten with the values of the story, for example you have to provide the values for the v, alpha, s, Agents and claims",\n' +
                          '"answer": "Answer of the question based on the story and the adapted question",\n' +
                          '"excerpt": "Excerpt from the story that justifies the answer for the critical questions",\n' +
                          '}'
                      }
                    }
                  }
                  prompt = prompt.replaceAll('[C_QUESTIONS]', questions).replaceAll('[C_SCHEME]', scheme).replaceAll('[C_FORMAT]', format)
                  let params = {
                    prompt: prompt,
                    llm: llm,
                    apiKey: apiKey,
                    documents: documents,
                    callback: callback
                  }
                  LLMClient.pdfBasedQuestion(params)
                })
              } else {
                let callback = () => {
                  window.open(chrome.runtime.getURL('pages/options.html'))
                }
                Alerts.infoAlert({
                  text: 'Please, configure your LLM.',
                  title: 'Please select a LLM and provide your API key',
                  callback: callback()
                })
              }
            })
          }
        })
      }
    })
  }

  parseAllPremisesAnswer (json, excerpts = false) {
    let gptItems
    gptItems = Array.from(Object.values(json)[0]).filter(item =>
      Object.keys(item).some(key => key.startsWith('name'))
    )
    let gptItemsNodes = []
    gptItems.forEach((item) => {
      gptItemsNodes.push({name: item.name, statement: item.statement, excerpt: item.excerpt})
    })
    return gptItemsNodes
  }

  parseAllCriticalQuestionsAnswer (json, excerpts = false) {
    let gptItems
    gptItems = Array.from(Object.values(json)[0]).filter(item =>
      Object.keys(item).some(key => key.startsWith('name'))
    )
    let gptItemsNodes = []
    gptItems.forEach((item) => {
      gptItemsNodes.push({name: item.name, adaptedQuestion: item.adaptedQuestion, excerpt: item.excerpt, answer: item.answer})
    })
    return gptItemsNodes
  }

  static arguments (criterion, description, paragraphs, annotation) {
    if (description.length < 20) {
      Alerts.infoAlert({ text: 'You have to provide a description for the given criterion' })
    } else {
      let scheme = ''
      let answer = ''
      let question = ''
      if (annotation.text) {
        let data = jsYaml.load(annotation.text)
        if (data.compile) {
          answer = data.compile.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
        }
        if (data.fullQuestion) {
          question = data.fullQuestion.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
        }
      }
      chrome.runtime.sendMessage({ scope: 'llm', cmd: 'getSelectedLLM' }, async ({ llm }) => {
        if (llm === '') {
          llm = Config.review.defaultLLM
        }
        if (llm && llm !== '') {
          let selectedLLM = llm.modelType
          Alerts.confirmAlert({
            title: criterion + ' assessment',
            text: '<div style="text-align: justify;text-justify: inter-word">Do you want to generate arguments and counter-arguments using LLM?</div>',
            cancelButtonText: 'Cancel',
            callback: async () => {
              let documents = []
              documents = await LLMTextUtils.loadDocument()
              chrome.runtime.sendMessage({
                scope: 'llm',
                cmd: 'getAPIKEY',
                data: selectedLLM
              }, ({ apiKey }) => {
                let callback = (json) => {
                  let answer = json.answer
                  Alerts.answerCriterionAlert({
                    title: 'These are the arguments and counter arguments',
                    answer: answer,
                    description: description,
                    criterion: question.fullQuestion,
                    annotation: annotation,
                    type: 'alternative'
                  })
                }
                if (apiKey && apiKey !== '') {
                  chrome.runtime.sendMessage({ scope: 'prompt', cmd: 'getPrompt', data: {type: 'argumentsPrompt'} }, ({ prompt }) => {
                    let argumentsPrompt
                    if (prompt) {
                      argumentsPrompt = prompt
                    } else {
                      argumentsPrompt = Config.prompts.argumentsPrompt
                    }
                    if (window.abwa.tagManager) {
                      let currentTags = window.abwa.tagManager.currentTags
                      // Retrieve Premises
                      let premises = currentTags.filter(tag => {
                        return tag.config.options.group === 'Premises'
                      })
                      let conclusion
                      for (let i = 0; i < premises.length; i++) {
                        const premise = premises[i]
                        if (premise.config.name === 'Conclusion') {
                          conclusion = premise
                        } else {
                          scheme += premise.config.name.toUpperCase() + ' PREMISE: '
                          if (premise.config.options.compile.answer) {
                            scheme += premise.config.options.compile.answer + '\n'
                          } else {
                            scheme += premise.config.options.description + '\n'
                          }
                        }
                      }
                      scheme += conclusion.config.name.toUpperCase() + ': '
                      if (conclusion.config.options.compile.answer) {
                        scheme += conclusion.config.options.compile.answer + '\n'
                      } else {
                        scheme += conclusion.config.options.description + '\n'
                      }
                    }
                    argumentsPrompt = argumentsPrompt.replaceAll('[C_QUESTION]', question.fullQuestion).replaceAll('[C_ANSWER]', answer.answer).replaceAll('[C_NAME]', criterion).replaceAll('[C_SCHEME]', scheme)
                    let params = {
                      prompt: argumentsPrompt,
                      llm: llm,
                      apiKey: apiKey,
                      documents: documents,
                      callback: callback
                    }
                    LLMClient.pdfBasedQuestion(params)
                  })
                } else {
                  let callback = () => {
                    window.open(chrome.runtime.getURL('pages/options.html'))
                  }
                  Alerts.infoAlert({
                    text: 'Please, configure your LLM.',
                    title: 'Please select a LLM and provide your API key',
                    callback: callback()
                  })
                }
              })
            }
          })
        }
      })
    }
  }

  /**
   * Returns true if this criteria already exists, otherwise false
   * @param name
   * @return {boolean}
   */
  static alreadyExistsThisCriteriaName (name) {
    return !!_.find(window.abwa.tagManager.currentTags, (tag) => { return tag.config.name === name })
  }

  getSelectorsFromLLM (paragraph, documents) {
    let selectors = []
    let pageNumber = LLMTextUtils.getPageNumberFromDocuments(paragraph, documents)
    if (pageNumber) {
      let fragmentSelector = {
        type: 'FragmentSelector',
        conformsTo: 'http://tools.ietf.org/rfc/rfc3778',
        page: pageNumber
      }
      selectors.push(fragmentSelector)
      // let pageContent = LLMTextUtils.getPageContent(pageNumber)
      let page = documents.find(document => document.metadata.loc.pageNumber === pageNumber)
      let pageContent = page.pageContent
      pageContent = pageContent.replace(/(\r\n|\n|\r)/gm, ' ').replace(/\s+/g, ' ').trim()
      let index = LLMTextUtils.getIndexesOfParagraph(pageContent, paragraph)
      let textPositionSelector = {
        type: 'TextPositionSelector',
        start: index,
        end: index + paragraph.length
      }
      selectors.push(textPositionSelector)
      let textQuoteSelector = {
        type: 'TextQuoteSelector',
        exact: pageContent.substring(index, index + paragraph.length),
        prefix: pageContent.substring(index - 32, index),
        suffix: pageContent.substring(index + paragraph.length, index + paragraph.length + 32)
      }
      selectors.push(textQuoteSelector)
    }
    return selectors
  }

  static recap (currentTagGroup) {
    let criterion = currentTagGroup.config.name
    let tagGroupAnnotations
    let paragraphs = []
    if (window.abwa.contentAnnotator) {
      let annotations = window.abwa.contentAnnotator.allAnnotations
      // Mark as chosen annotated tags
      for (let i = 0; i < annotations.length; i++) {
        let model = window.abwa.tagManager.model
        let tag = model.namespace + ':' + model.config.grouped.relation + ':' + criterion
        tagGroupAnnotations = annotations.filter((annotation) => {
          return AnnotationUtils.hasATag(annotation, tag)
        })
      }
    }
    if (tagGroupAnnotations) {
      for (let i = 0; i < tagGroupAnnotations.length; i++) {
        let annotation = tagGroupAnnotations[i]
        let selectors = annotation.target[0].selector
        let pageSelector
        if (selectors) {
          pageSelector = selectors.find((selector) => {
            return selector.type === 'FragmentSelector'
          })
        }
        if (annotation.text) {
          let body = JSON.parse(annotation.text)
          if (body.paragraph) {
            paragraphs.push('(page ' + pageSelector.page + '): ' + body.paragraph.replace(/(\r\n|\n|\r)/gm, ''))
          } else {
            let fragmentTextSelector
            if (selectors) {
              fragmentTextSelector = selectors.find((selector) => {
                return selector.type === 'TextQuoteSelector'
              })
            }
            if (fragmentTextSelector) {
              paragraphs.push('(page' + pageSelector.page + '): ' + fragmentTextSelector.exact.replace(/(\r\n|\n|\r)/gm, ''))
            }
          }
        }
      }
    }
    let compile = ''
    if (currentTagGroup.config.options.compile !== '') {
      const findResume = currentTagGroup.config.options.compile.find((resume) => {
        return resume.document === window.abwa.contentTypeManager.pdfFingerprint
      })
      if (findResume) {
        compile = findResume
      }
    }
    let alternative = ''
    if (currentTagGroup.config.options.alternative !== '') {
      const findAlternative = currentTagGroup.config.options.alternative.find((alternative) => {
        return alternative.document === window.abwa.contentTypeManager.pdfFingerprint
      })
      if (findAlternative) {
        alternative = findAlternative.answer
      }
    }
    let fullQuestion = ''
    if (currentTagGroup.config.options.fullQuestion && currentTagGroup.config.options.fullQuestion !== '') {
      const findFullQuestion = currentTagGroup.config.options.fullQuestion.find((fullQuestion) => {
        return fullQuestion.document === window.abwa.contentTypeManager.pdfFingerprint
      })
      if (findFullQuestion) {
        fullQuestion = findFullQuestion.fullQuestion
      }
    }
    let feedback = ''
    let findFeedback
    if (currentTagGroup.config.options.feedback && (currentTagGroup.config.options.feedback !== '')) {
      findFeedback = currentTagGroup.config.options.feedback.find((feedback) => {
        return feedback.document === window.abwa.contentTypeManager.pdfFingerprint
      })
      if (findFeedback) {
        feedback = findFeedback.comment + ' - ' + findFeedback.rate
      }
    }
    if (compile || alternative || paragraphs.length > 0) {
      let html = '<div width=900px style="text-align: justify;text-justify: inter-word">'
      if (compile) {
        html += '<h3>Description:</h3><div width=800px>' + currentTagGroup.config.options.description + '</div></br>'
      }
      if (currentTagGroup.config.options.fullQuestion) {
        html += '<h3>Question:</h3><div width=800px>' + fullQuestion + '</div></br>'
      }
      if (compile) {
        html += '<h3>Statement:</h3><div width=800px>' + compile.answer + '</div></br>'
      }
      if (alternative) {
        html += '<h3>Arguments:</h3><div width=800px>' + alternative + '</div></br>'
      }
      if (feedback) {
        html += '<h3>Feedback:</h3><div width=800px>' + feedback + '</div></br>'
      }
      if (paragraphs.length > 0) {
        html += '<h3>Excerpts:</h3></br><ul>'
        for (const item of paragraphs) {
          html += `<div style="margin-left: 30px"><li>${item}</li></div></br>`
        }
        html += '</ul></div>'
      }
      html += '</div>'
      let cancelButtonText
      if (feedback) {
        cancelButtonText = 'Edit feedback'
      } else {
        cancelButtonText = 'Provide feedback'
      }
      Alerts.criterionInfoAlert({
        title: criterion,
        text: html,
        cancelButtonText: cancelButtonText,
        showCancelButton: true,
        cancelButtonColor: '#d2371d',
        cancelCallback: () => {
          CustomCriteriasManager.provideFeedback(currentTagGroup, findFeedback)
        }
      })
    } else {
      Alerts.errorAlert({
        title: 'No assessed',
        text: 'You must assess this criteria. Highlight, resume or find alternatives for the criterion.'
      })
    }
  }

  getParagraphs (criterion, callback) {
    let tagGroupAnnotations
    let paragraphs
    if (window.abwa.contentAnnotator) {
      let annotations = window.abwa.contentAnnotator.allAnnotations
      // Mark as chosen annotated tags
      for (let i = 0; i < annotations.length; i++) {
        let model = window.abwa.tagManager.model
        let tag = model.namespace + ':' + model.config.grouped.relation + ':' + criterion
        tagGroupAnnotations = annotations.filter((annotation) => {
          return AnnotationUtils.hasATag(annotation, tag)
        })
      }
    }
    if (tagGroupAnnotations) {
      paragraphs = ''
      for (let i = 0; i < tagGroupAnnotations.length; i++) {
        let annotation = tagGroupAnnotations[i]
        if (annotation.text) {
          let body = JSON.parse(annotation.text)
          if (body.paragraph) {
            let paragraphNumber = i + 1
            paragraphs += 'paragraph' + paragraphNumber + ': ' + body.paragraph.replace(/(\r\n|\n|\r)/gm, '') + '\n'
          } else {
            let selectors = annotation.target[0].selector
            let fragmentTextSelector
            if (selectors) {
              fragmentTextSelector = selectors.find((selector) => {
                return selector.type === 'TextQuoteSelector'
              })
            }
            if (fragmentTextSelector) {
              let paragraphNumber = i + 1
              paragraphs += 'paragraph' + paragraphNumber + ': ' + fragmentTextSelector.exact.replace(/(\r\n|\n|\r)/gm, '') + '\n'
            }
          }
        }
      }
    }
    if (_.isFunction(callback)) {
      callback(paragraphs)
    }
  }
}

export default CustomCriteriasManager
