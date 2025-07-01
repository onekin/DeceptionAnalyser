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
    // Initialize event handlers
    this.initEventHandler()
    // Init context menu for buttons
    this.initContextMenu()
    if (_.isFunction(callback)) {
      callback()
    }
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

  static createAddCustomCriteriaButtonHandler (groupName) {
    let criteriaName
    let criteriaDescription
    let elementName = groupName.toLowerCase().replace(/s$/, '')
    Alerts.multipleInputAlert({
      title: 'Creating a new criterion for category ' + groupName,
      html: '<div>' +
        '<input id="criteriaName" class="swal2-input customizeInput" placeholder="Type your ' + elementName + ' name..."/>' +
        '</div>' +
        '<div>' +
        '<textarea id="criteriaDescription" class="swal2-input customizeInput" placeholder="Type your ' + elementName + ' description..."></textarea>' +
        '</div>',
      preConfirm: () => {
        // Retrieve values from inputs
        criteriaName = document.getElementById('criteriaName').value
        criteriaDescription = document.getElementById('criteriaDescription').value
        // Find if criteria name already exists
        let currentTags = _.map(window.abwa.tagManager.currentTags, tag => tag.config.name)
        let criteriaExists = _.find(currentTags, tag => tag === criteriaName)
        if (_.isString(criteriaExists)) {
          const swal = require('sweetalert2')
          swal.showValidationMessage('A criteria with that name already exists.')
          window.abwa.sidebar.openSidebar()
        }
      },
      callback: (err) => {
        if (err) {
          Alerts.errorAlert({ text: 'Unable to create this custom criteria, try it again.' })
        } else {
          // Check if not selected cancel or esc
          if (criteriaName) {
            CustomCriteriasManager.createNewCustomCriteria({
              name: criteriaName,
              description: criteriaDescription,
              group: groupName,
              callback: () => {
                window.abwa.sidebar.openSidebar()
              }
            })
          }
        }
      }
    })
  }

  static createNewCustomCriteria ({ name, description = 'Custom criteria', group, callback }) {
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
    $.contextMenu({
      selector: '.tagGroup[data-group-name]',
      build: (trigger) => {
        let criteriaGroupName = trigger.attr('data-group-name')

        // Dynamically create items based on the specific group
        let items = {}

        if (criteriaGroupName === 'Premises') {
          items = {
            'annotate': { name: 'Annotate all Premises' },
            'addTheme': { name: 'New Premise' }
          }
        } else if (criteriaGroupName === 'Critical questions') {
          items = {
            'annotate': { name: 'Formulate all Critical Questions' },
            'addTheme': { name: 'New Critical Question' }
          }
        }

        return {
          callback: (key, ev) => {
            if (key === 'annotate') {
              if (criteriaGroupName === 'Premises') {
                this.annotateAllPremises(criteriaGroupName)
              } else if (criteriaGroupName === 'Critical questions') {
                this.formulateAllCriticalQuestions(criteriaGroupName)
              }
            } else if (key === 'addTheme') {
              if (criteriaGroupName === 'Premises') {
                // this.addNewPremise(criteriaGroupName)
              } else if (criteriaGroupName === 'Critical questions') {
                // this.addNewQuestion(criteriaGroupName)
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
        // items['annotatePremise'] = { name: 'State premise with annotation' }
        // Find alternative viewpoints by LLM
        items['recap'] = { name: 'Show analysis' }
        items['delete'] = { name: 'Delete Premise' }
      } else if (tagGroup.config.options.group === 'Critical questions') {
        // Highlight criterion by LLM
        // items['annotateCriticalQuestion'] = { name: 'Formulate question' }
        // items['arguments'] = { name: 'Arguments & Counter-Arguments' }
        items['recap'] = { name: 'Show analysis' }
        items['delete'] = { name: 'Delete Critical Question' }
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
              } else if (key === 'delete') {
                // Delete the tag
                CustomCriteriasManager.deleteCriteriaHandler(tagGroup)
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
              if (apiKey && apiKey !== '') {
                chrome.runtime.sendMessage({ scope: 'prompt', cmd: 'getPrompt', data: {type: 'annotatePremisePrompt'} }, ({ prompt }) => {
                  if (!prompt) {
                    prompt = Config.prompts.annotatePremisePrompt
                  }
                  let scheme = ''
                  let schemeObjects = []
                  let conclusion = {}
                  let conclusionElement
                  if (window.abwa.tagManager) {
                    let currentTags = window.abwa.tagManager.currentTags
                    // Retrieve Premises
                    let premises = currentTags.filter(tag => {
                      return tag.config.options.group === 'Premises'
                    })
                    for (let i = 0; i < premises.length; i++) {
                      const premise = premises[i]
                      if (premise.config.name === 'Conclusion') {
                        conclusionElement = premise
                      } else {
                        let schemaElement = {}
                        scheme += premise.config.name.toUpperCase() + ' PREMISE: '
                        scheme += premise.config.options.description + '\n'
                        schemaElement.name = premise.config.name
                        schemaElement.description = premise.config.options.description
                        schemeObjects.push(schemaElement)
                      }
                    }
                    if (conclusionElement) {
                      scheme += conclusionElement.config.name.toUpperCase() + ': '
                      scheme += conclusionElement.config.options.description
                      conclusion.name = 'Conclusion'
                      conclusion.description = conclusionElement.config.options.description
                    }
                    console.log('schemeObjects', schemeObjects)
                    console.log('conclusion', conclusion)
                    console.log('scheme', scheme)
                  }
                  const promises = schemeObjects.map((schemeElem) => this.askPremisesLLM(prompt, scheme, schemeElem, llm, apiKey, documents))
                  Promise.all(promises)
                    .then((responses) => {
                      // console.log('✅ All responses:', responses)
                      const stringifiedResponses = JSON.stringify(responses, null, 2)
                      console.log(stringifiedResponses)
                      let conclusionPrompt = Config.prompts.resolveConclusion
                      conclusionPrompt = conclusionPrompt.replaceAll('[C_SCHEME]', scheme)
                      conclusionPrompt = conclusionPrompt.replaceAll('[C_NAME]', conclusion.name)
                      conclusionPrompt = conclusionPrompt.replaceAll('[C_DESCRIPTION]', conclusion.description)
                      conclusionPrompt = conclusionPrompt.replaceAll('[C_PREMISES]', stringifiedResponses)
                      const params = {
                        prompt: conclusionPrompt,
                        llm: llm,
                        apiKey: apiKey,
                        documents: documents,
                        message: 'Resolving the conclusion based on the premises...',
                        callback: (json) => {
                          // let answers = this.parseAllPremisesAnswer(responses)
                          let tagAnnotations = []
                          if (responses.length > 0) {
                            responses.forEach(answer => {
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
                                if (!Array.isArray(data.llmExcerpt)) {
                                  data.llmExcerpt = []
                                }
                                let foundLLMExcerpt = data.llmExcerpt.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
                                if (!foundLLMExcerpt) {
                                  // If not, create and add it to the array
                                  data.llmExcerpt.push({ document: window.abwa.contentTypeManager.pdfFingerprint, excerpt: excerpt })
                                } else {
                                  foundLLMExcerpt.excerpt = excerpt
                                }
                              }
                              tagAnnotation.text = jsYaml.dump(data)
                              tagAnnotations.push(tagAnnotation)
                            })
                          }
                          LanguageUtils.dispatchCustomEvent(Events.updateTagAnnotations, {annotations: tagAnnotations})
                          // Conclusion
                          let conclusionData
                          let conclusionTagGroup = _.find(window.abwa.tagManager.currentTags, currentTag => currentTag.config.name === conclusion.name)
                          let conclusionAnnotation = conclusionTagGroup.config.annotation
                          if (conclusionAnnotation.text) {
                            conclusionData = jsYaml.load(conclusionAnnotation.text)
                            // Check if data.resume exists and is an array. If not, initialize it as an empty array.
                            if (!Array.isArray(conclusionData.compile)) {
                              conclusionData.compile = []
                            }
                            let foundCompile = conclusionData.compile.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
                            if (!foundCompile) {
                              // If not, create and add it to the array
                              conclusionData.compile.push({ document: window.abwa.contentTypeManager.pdfFingerprint, answer: json.statement, sentiment: json.sentiment })
                            } else {
                              foundCompile.answer = conclusion.statement
                              foundCompile.sentiment = json.sentiment
                            }
                          }
                          conclusionAnnotation.text = jsYaml.dump(conclusionData)
                          tagAnnotations.push(conclusionAnnotation)
                          LanguageUtils.dispatchCustomEvent(Events.updateTagAnnotations, {annotations: conclusionAnnotation})
                          Alerts.successAlert({title: 'Available analysis', text: 'Critical questions completed'})
                        }
                      }
                      LLMClient.pdfBasedQuestion(params)
                    })
                    .catch((error) => {
                      console.error('❌ Error with one of the LLM calls:', error)
                    })
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

  askPremisesLLM (prompt, scheme, schemeElem, llm, apiKey, documents) {
    return new Promise((resolve, reject) => {
      const promptInstance = prompt
        .replaceAll('[C_SCHEME]', scheme)
        .replaceAll('[C_NAME]', schemeElem.name)
        .replaceAll('[C_DESCRIPTION]', schemeElem.description)

      const params = {
        prompt: promptInstance,
        llm: llm,
        apiKey: apiKey,
        documents: documents,
        message: 'Asking for resolving premises...',
        callback: (response) => {
          resolve(response)
        }
      }

      try {
        LLMClient.pdfBasedQuestion(params)
      } catch (err) {
        reject(err)
      }
    })
  }

  askQuestionsLLM (prompt, scheme, questionElem, llm, apiKey, documents) {
    return new Promise((resolve, reject) => {
      const promptInstance = prompt
        .replaceAll('[C_SCHEME]', scheme)
        .replaceAll('[C_DESCRIPTION]', questionElem.description)
        .replaceAll('[C_NAME]', questionElem.name)

      const params = {
        prompt: promptInstance,
        llm: llm,
        apiKey: apiKey,
        documents: documents,
        message: 'Asking for resolving critical questions...',
        callback: (response) => {
          resolve(response)
        }
      }

      try {
        LLMClient.pdfBasedQuestion(params)
      } catch (err) {
        reject(err)
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
                      message: 'Asking for resolving critical questions...',
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
    // this.modifyCriteriaHandler
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
              if (apiKey && apiKey !== '') {
                chrome.runtime.sendMessage({ scope: 'prompt', cmd: 'getPrompt', data: {type: 'criticalQuestionPrompt'} }, ({ prompt }) => {
                  if (!prompt) {
                    prompt = Config.prompts.criticalQuestionPrompt
                  }
                  let scheme = ''
                  let questionsObjects = []
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
                    if (conclusion) {
                      scheme += conclusion.config.name.toUpperCase() + ': '
                      if (conclusion.config.options.compile.answer) {
                        scheme += conclusion.config.options.compile.answer + '\n'
                      } else {
                        scheme += conclusion.config.options.description + '\n'
                      }
                    }
                    // Retrieve CRITICAL QUESTIONS
                    let criticalQuestions = currentTags.filter(tag => {
                      return tag.config.options.group === 'Critical questions'
                    })
                    for (let i = 0; i < criticalQuestions.length; i++) {
                      const criticalQuestionElement = {}
                      const criticalQuestion = criticalQuestions[i]
                      criticalQuestionElement.name = criticalQuestion.config.name
                      criticalQuestionElement.description = criticalQuestion.config.options.description
                      questionsObjects.push(criticalQuestionElement)
                    }
                  }
                  prompt = prompt.replaceAll('[C_SCHEME]', scheme)
                  const promises = questionsObjects.map((questionElem) => this.askQuestionsLLM(prompt, scheme, questionElem, llm, apiKey, documents))
                  Promise.all(promises)
                    .then((responses) => {
                      let tagAnnotations = []
                      if (responses.length > 0) {
                        responses.forEach(llmAnswer => {
                          let excerpt = llmAnswer.excerpt
                          let question = llmAnswer.adaptedQuestion
                          let answer = llmAnswer.answer
                          let alternatives = llmAnswer.arguments
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
                              if (!Array.isArray(data.alternative)) {
                                data.alternative = []
                              }
                              let foundArguments = data.alternative.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
                              if (!foundArguments) {
                                // If not, create and add it to the array
                                data.alternative.push({
                                  document: window.abwa.contentTypeManager.pdfFingerprint,
                                  alternative: alternatives
                                })
                              } else {
                                foundArguments.alternative = alternatives
                              }
                              if (!Array.isArray(data.llmExcerpt)) {
                                data.llmExcerpt = []
                              }
                              let foundLLMExcerpt = data.llmExcerpt.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
                              if (!foundLLMExcerpt) {
                                // If not, create and add it to the array
                                data.llmExcerpt.push({ document: window.abwa.contentTypeManager.pdfFingerprint, excerpt: excerpt })
                              } else {
                                foundLLMExcerpt.excerpt = excerpt
                              }
                              tagAnnotation.text = jsYaml.dump(data)
                              tagAnnotations.push(tagAnnotation)
                            }
                          }
                        })
                      }
                      LanguageUtils.dispatchCustomEvent(Events.updateTagAnnotations, {annotations: tagAnnotations})
                      Alerts.successAlert({title: 'Available analysis', text: 'Critical questions completed'})
                    })
                    .catch((error) => {
                      console.error('❌ Error with one of the LLM calls:', error)
                    })
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
        alternative = findAlternative.alternative
      }
    }
    let excerpt = ''
    if (currentTagGroup.config.options.llmExcerpt) {
      const findLLMExcerpt = currentTagGroup.config.options.llmExcerpt.find((excerpt) => {
        return excerpt.document === window.abwa.contentTypeManager.pdfFingerprint
      })
      if (findLLMExcerpt) {
        excerpt = findLLMExcerpt.excerpt
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
    let statement = ''
    if (compile && compile.answer && compile.answer.statement) {
      statement = compile.answer.statement
    } else {
      statement = compile.answer
    }
    let sentiment = ''
    if (compile && compile.answer && compile.answer.sentiment) {
      sentiment = compile.answer.sentiment
    }
    if (compile || alternative || paragraphs.length > 0) {
      const redFace = chrome.runtime.getURL('/images/red.png')
      const yellowFace = chrome.runtime.getURL('/images/yellow.png')
      const greenFace = chrome.runtime.getURL('/images/green.png')
      let html = '<div width=900px style="text-align: justify;text-justify: inter-word">'
      if (sentiment) {
        html += `
        <h3>Sentiment:</h3>
        <div id="sentiment-container" style="width:800px; display:flex; gap:20px; align-items:center;">
          <img src="${redFace}" data-sentiment="red" style="height:50px; cursor:pointer; ${sentiment === 'red' ? 'border:4px solid red; border-radius:8px;' : ''}">
          <img src="${yellowFace}" data-sentiment="yellow" style="height:50px; cursor:pointer; ${sentiment === 'yellow' ? 'border:4px solid orange; border-radius:8px;' : ''}">
          <img src="${greenFace}" data-sentiment="green" style="height:50px; cursor:pointer; ${sentiment === 'green' ? 'border:4px solid green; border-radius:8px;' : ''}">
        </div><br/>
      `
      }
      if (compile) {
        html += '<h3>Description:</h3><div width=800px>' + currentTagGroup.config.options.description + '</div></br>'
      }
      if (currentTagGroup.config.options.fullQuestion) {
        html += '<h3>Question:</h3><div width=800px>' + fullQuestion + '</div></br>'
      }
      if (compile.answer) {
        html += '<h3>Statement:</h3><div width=800px>' + statement + '</div></br>'
      }
      if (alternative) {
        html += '<h3>Arguments:</h3><div width=800px>' + alternative.replaceAll('</br>-', '</br></br>-') + '</div></br>'
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
      } else if (excerpt) {
        html += '<h3>Excerpt:</h3><div width=800px>' + excerpt + '</div></br>'
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
        currentTagGroup: currentTagGroup,
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

  static attachSentimentListeners (currentTagGroup, selected) {
    console.log('Attaching sentiment listeners: ' + selected)
    // Get all the images in the container
    const images = document.querySelectorAll('img[data-sentiment]')

    images.forEach(img => {
      img.addEventListener('click', () => {
        const chosen = img.getAttribute('data-sentiment')
        console.log('Sentiment chosen:', chosen)

        // 1️⃣ Visually update borders
        images.forEach(i => {
          i.style.border = ''
        })
        if (chosen === 'red') {
          img.style.border = '4px solid red'
          img.style.borderRadius = '8px'
        } else if (chosen === 'yellow') {
          img.style.border = '4px solid orange'
          img.style.borderRadius = '8px'
        } else if (chosen === 'green') {
          img.style.border = '4px solid green'
          img.style.borderRadius = '8px'
        }
      })
    })
    let compile = ''
    if (currentTagGroup.config.options.compile !== '') {
      const findResume = currentTagGroup.config.options.compile.find((resume) => {
        return resume.document === window.abwa.contentTypeManager.pdfFingerprint
      })
      if (findResume) {
        compile = findResume
      }
    }
    if (compile && compile.answer && compile.answer.sentiment) {
      compile.answer.sentiment = selected
    }
    // todo update tag annotation
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
