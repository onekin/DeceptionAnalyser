import LLMClient from '../llm/LLMClient'
import LLMTextUtils from '../utils/LLMTextUtils'
import Alerts from '../utils/Alerts'
import LanguageUtils from '../utils/LanguageUtils'
import Events from './Events'
import Premise from '../model/schema/Premise'
import CriticalQuestion from '../model/schema/CriticalQuestion'
import Level from '../model/schema/Level'
import Review from '../model/schema/Review'
import DefaultCriteria from '../model/schema/DefaultCriteria'
import _ from 'lodash'
import $ from 'jquery'
import 'jquery-contextmenu/dist/jquery.contextMenu'
import Config from '../Config'
import AnnotationUtils from '../utils/AnnotationUtils'
import jsYaml from 'js-yaml'

class CustomCriteriaManager {
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
    this.events.criteriaUpdated = {
      element: document,
      event: Events.criteriaUpdated,
      handler: () => {
        // this.createAddCustomCriteriaButtons()
        this.initContextMenu()
      }
    }
    this.events.criteriaUpdated.element.addEventListener(this.events.criteriaUpdated.event, this.events.criteriaUpdated.handler, false)
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
        let currentCriterionGroups = _.map(window.abwa.criteriaManager.currentCriterionGroups, criterionGroup => criterionGroup.config.name)
        let criteriaExists = _.find(currentCriterionGroups, criterionGroup => criterionGroup === criteriaName)
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
            CustomCriteriaManager.createNewCustomCriteria({
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
    let criteria = new Premise({ name, description, review, group: group })
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
        window.abwa.criteriaManager.reloadCriteria(() => {
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
          let criteria = new Premise({
            name: tagGroup.config.name,
            description: tagGroup.config.options.description,
            group: tagGroup.config.options.group,
            review,
            feedback: tagGroup.config.options.feedback || []
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
    let arrayOfTagGroups = _.values(window.abwa.criteriaManager.currentCriterionGroups)
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
    // Refresh LLM indicator
    if (window.abwa.specific && window.abwa.specific.reviewGenerator) {
      window.abwa.specific.reviewGenerator.updateLLMIndicator()
    }
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
    let arrayOfTagGroups = _.values(window.abwa.criteriaManager.currentCriterionGroups)
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
              let currentCriterionGroup = _.find(window.abwa.criteriaManager.currentCriterionGroups, currentTag => currentTag.config.annotation.id === tagGroup.config.annotation.id)
              if (key === 'compile') {
                this.getParagraphs(criterion, (paragraphs) => {
                  if (paragraphs) {
                    CustomCriteriaManager.compile(criterion, description, paragraphs, currentCriterionGroup.config.annotation)
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
                    CustomCriteriaManager.arguments(criterion, description, paragraphs, currentCriterionGroup.config.annotation)
                  } else {
                    Alerts.errorAlert({
                      title: 'There are not annotations',
                      text: 'Please, highlight some paragraphs to assess the ' + criterion
                    })
                  }
                })
              } else if (key === 'recap') {
                CustomCriteriaManager.recap(currentCriterionGroup)
              } else if (key === 'delete') {
                // Delete the tag
                CustomCriteriaManager.deleteCriteriaHandler(tagGroup)
              } else if (key === 'annotatePremise') {
                if (currentCriterionGroup.config.name === 'Conclusion') {
                  // Find conclusion tag and if it has a statement
                  let majorTag = _.find(window.abwa.criteriaManager.currentCriterionGroups, currentTag => currentTag.config.name === 'Major')
                  let currentMajorPremise
                  if ((majorTag.config.options.assessments || majorTag.config.options.compile) === '') {
                    Alerts.errorAlert({
                      title: 'You do not have set the major premise',
                      text: 'Please, retrieve the major premise to draw the conclusion.'
                    })
                  } else if ((majorTag.config.options.assessments || majorTag.config.options.compile)) {
                    currentMajorPremise = (majorTag.config.options.assessments || majorTag.config.options.compile).find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
                    if (currentMajorPremise) {
                      this.annotatePremise(criterion, description, currentCriterionGroup.config.annotation)
                    } else {
                      Alerts.errorAlert({
                        title: 'You do not have a conclusion',
                        text: 'Please, retrieve the major premise to draw the conclusion.'
                      })
                    }
                  }
                } else {
                  this.getParagraphs(criterion, (paragraphs) => {
                    this.annotatePremise(criterion, description, currentCriterionGroup.config.annotation, paragraphs)
                  })
                }
              } else if (key === 'annotateCriticalQuestion') {
                // Find conclusion tag and if it has a statement
                let conclusionTag = _.find(window.abwa.criteriaManager.currentCriterionGroups, currentTag => currentTag.config.name === 'Conclusion')
                let currentConclusion
                if ((conclusionTag.config.options.assessments || conclusionTag.config.options.compile) === '') {
                  Alerts.errorAlert({
                    title: 'You do not have a conclusion',
                    text: 'Please, retrieve a conclusion to formulate a critical question.'
                  })
                } else if ((conclusionTag.config.options.assessments || conclusionTag.config.options.compile)) {
                  currentConclusion = (conclusionTag.config.options.assessments || conclusionTag.config.options.compile).find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
                  if (currentConclusion) {
                    this.getParagraphs(criterion, (paragraphs) => {
                      this.formulateCriticalQuestion(criterion, description, currentCriterionGroup.config.annotation, paragraphs)
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
      CustomCriteriaManager.editFeedback(tagGroup, feedback)
      // You can perform further actions with the found rating here
    } else {
      CustomCriteriaManager.newFeedback(tagGroup)
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
        LanguageUtils.dispatchCustomEvent(Events.updateCriteriaAnnotation, {annotation: annotation})
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
        LanguageUtils.dispatchCustomEvent(Events.updateCriteriaAnnotation, {annotation: annotation})
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
          CustomCriteriaManager.deleteTag(tagGroup, () => {
            window.abwa.criteriaManager.reloadCriteria(() => {
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
    let fullQuestion = defaultFullQuestion || ''
    // Read adaptedQuestion from new assessments format, with fallback to old fullQuestion array
    if (!fullQuestion && tagGroup.config.options.assessments && Array.isArray(tagGroup.config.options.assessments)) {
      let foundAssessment = tagGroup.config.options.assessments.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
      if (foundAssessment && foundAssessment.adaptedQuestion) {
        fullQuestion = foundAssessment.adaptedQuestion
      }
    }
    if (!fullQuestion && tagGroup.config.options.fullQuestion) {
      if (Array.isArray(tagGroup.config.options.fullQuestion)) {
        let foundFQ = tagGroup.config.options.fullQuestion.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
        if (foundFQ) {
          fullQuestion = foundFQ.fullQuestion
        }
      } else {
        fullQuestion = tagGroup.config.options.fullQuestion
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
        CustomCriteriaManager.restoreTag(tagGroup, (annotation) => {
          console.log('Restored' + annotation)
          window.abwa.criteriaManager.reloadCriteria(() => {
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
      const currentFullQuestion = data.assessments 
        ? (data.assessments.find(a => a.document === window.abwa.contentTypeManager.pdfFingerprint) || {}).adaptedQuestion 
        : (data.fullQuestion ? (data.fullQuestion.find(fq => fq.document === window.abwa.contentTypeManager.pdfFingerprint) || {}).fullQuestion : undefined)
      if ((description !== data.description || _.isUndefined(description)) || (fullQuestion !== currentFullQuestion || _.isUndefined(fullQuestion))) {
        name = name || tagGroup.config.name
        description = description || data.description
        // Update adaptedQuestion in assessments (new format) or fullQuestion (old format)
        if (!_.isUndefined(fullQuestion)) {
          if (data.assessments && Array.isArray(data.assessments)) {
            let foundAssessment = data.assessments.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
            if (!foundAssessment) {
              data.assessments.push({ document: window.abwa.contentTypeManager.pdfFingerprint, documentTitle: window.abwa.contentTypeManager.documentTitle || '', adaptedQuestion: fullQuestion })
            } else {
              foundAssessment.adaptedQuestion = fullQuestion
            }
          } else if (data.fullQuestion) {
            // Backward compat: old format
            if (!Array.isArray(data.fullQuestion)) {
              data.fullQuestion = [{ document: window.abwa.contentTypeManager.pdfFingerprint, fullQuestion: fullQuestion }]
            } else {
              let foundFullQuestion = data.fullQuestion.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
              if (!foundFullQuestion) {
                data.fullQuestion.push({ document: window.abwa.contentTypeManager.pdfFingerprint, fullQuestion: fullQuestion })
              } else {
                foundFullQuestion.fullQuestion = fullQuestion
              }
            }
          } else {
            // Initialize assessments array
            data.assessments = [{ document: window.abwa.contentTypeManager.pdfFingerprint, adaptedQuestion: fullQuestion }]
          }
        }
        // Update annotation description
        let oldAnnotation = tagGroup.config.annotation
        // Create new annotation
        let review = new Review({ reviewId: '' })
        review.storageGroup = window.abwa.groupSelector.currentGroup
        let criteria = new Premise({
          name: name,
          description: description,
          group: group || tagGroup.config.options.group,
          review,
          feedback: data.feedback || []
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
      if (CustomCriteriaManager.alreadyExistsThisCriteriaName(name)) {
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
              let criteria = new Premise({
                name,
                description,
                group: tagGroup.config.options.group,
                review
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
        findFeedback = data.feedback.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
      }
    }
    if (findFeedback) {
      this.annotatePremiseWithFeedback(criterion, description, tagAnnotation, findFeedback, data, paragraphs)
    } else {
      // this.modifyCriteriaHandler(currentCriterionGroup)
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
                  let sentiment = json.sentiment
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
                    let model = window.abwa.criteriaManager.model
                    let tag = [
                      model.namespace + ':' + model.config.grouped.relation + ':' + criterion
                    ]
                    CustomCriteriaManager.deleteTagAnnotations(tag, () => {
                      LanguageUtils.dispatchCustomEvent(Events.annotateByLLM, {
                        tags: tag,
                        selectors: selectors,
                        commentData: commentData
                      })
                    })
                  }
                  if (annotation.selectors.length === 0) {
                    CustomCriteriaManager.showParagraph(annotation, criterion)
                  } else {
                    CustomCriteriaManager.showAnnotatedParagraph(annotation, criterion)
                  }
                  // retrieve tag annotation
                  let data
                  if (tagAnnotation.text) {
                    data = jsYaml.load(tagAnnotation.text)
                    // Check if data.resume exists and is an array. If not, initialize it as an empty array.
                    data.assessments = []
                    // Now that we're sure data.resume is an array, push the new object into it.
                    data.assessments.push({ document: window.abwa.contentTypeManager.pdfFingerprint, documentTitle: window.abwa.contentTypeManager.documentTitle || '', answer: { statement: statement, excerpt: excerpt, sentiment: sentiment }, llm: llm.model })
                  }
                  tagAnnotation.text = jsYaml.dump(data)
                  LanguageUtils.dispatchCustomEvent(Events.updateCriteriaAnnotation, {annotation: tagAnnotation})
                  Alerts.successAlert({title: 'Saved', text: 'The text has been saved in the report'})
                }
                if (apiKey && apiKey !== '') {
                  chrome.runtime.sendMessage({ scope: 'prompt', cmd: 'getPrompt', data: {type: 'annotatePremisePrompt'} }, ({ prompt }) => {
                    if (!prompt) {
                      prompt = Config.prompts.annotatePremisePrompt
                    }
                    let scheme = ''
                    if (window.abwa.criteriaManager) {
                      let currentCriterionGroups = window.abwa.criteriaManager.currentCriterionGroups
                      // Retrieve Premises
                      let premises = currentCriterionGroups.filter(criterionGroup => {
                        return criterionGroup.config.options.group === 'Premises'
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
                    callback: callback
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
                    let sentiment = json.sentiment
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
                      let model = window.abwa.criteriaManager.model
                      let tag = [
                        model.namespace + ':' + model.config.grouped.relation + ':' + criterion
                      ]
                      CustomCriteriaManager.deleteTagAnnotations(tag, () => {
                        LanguageUtils.dispatchCustomEvent(Events.annotateByLLM, {
                          tags: tag,
                          selectors: selectors,
                          commentData: commentData
                        })
                      })
                    }
                    if (annotation.selectors.length === 0) {
                      CustomCriteriaManager.showParagraph(annotation, criterion)
                    } else {
                      CustomCriteriaManager.showAnnotatedParagraph(annotation, criterion)
                    }
                    // retrieve tag annotation
                    let data
                    if (tagAnnotation.text) {
                      data = jsYaml.load(tagAnnotation.text)
                      // Check if data.resume exists and is an array. If not, initialize it as an empty array.
                      data.assessments = []
                      // Now that we're sure data.resume is an array, push the new object into it.
                      data.assessments.push({ document: window.abwa.contentTypeManager.pdfFingerprint, documentTitle: window.abwa.contentTypeManager.documentTitle || '', answer: { statement: statement, excerpt: excerpt, sentiment: sentiment }, llm: llm.model })
                      data.feedback = []
                    }
                    tagAnnotation.text = jsYaml.dump(data)
                    LanguageUtils.dispatchCustomEvent(Events.updateCriteriaAnnotation, {annotation: tagAnnotation})
                    Alerts.successAlert({title: 'Saved', text: 'The text has been saved in the report'})
                  }
                  if (apiKey && apiKey !== '') {
                    chrome.runtime.sendMessage({ scope: 'prompt', cmd: 'getPrompt', data: {type: 'annotatePremisePrompt'} }, ({ prompt }) => {
                      if (!prompt) {
                        prompt = Config.prompts.annotatePremisePrompt
                      }
                      let scheme = ''
                      if (window.abwa.criteriaManager) {
                        let currentCriterionGroups = window.abwa.criteriaManager.currentCriterionGroups
                        // Retrieve Premises
                        let premises = currentCriterionGroups.filter(criterionGroup => {
                          return criterionGroup.config.options.group === 'Premises'
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
                        let findStatement = previousAnswer.assessments.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
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
                      callback: callback
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
          alertType: Alerts.alertType.question,
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
                  if (window.abwa.criteriaManager) {
                    let currentCriterionGroups = window.abwa.criteriaManager.currentCriterionGroups
                    // Retrieve Premises
                    let premises = currentCriterionGroups.filter(criterionGroup => {
                      return criterionGroup.config.options.group === 'Premises'
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
                  const total = schemeObjects.length
                  let completed = 0
                  const promises = schemeObjects.map((schemeElem) =>
                    this.askPremisesLLM(prompt, scheme, schemeElem, llm, apiKey, documents)
                      .then(result => {
                        completed++
                        Swal.update({ text: `Processing premises... ${completed}/${total}` })
                        return result
                      })
                  )
                  // Show a single persistent loading dialog for the entire batch
                  let Swal
                  if (document && document.head) {
                    Swal = require('sweetalert2')
                  }
                  Swal.fire({
                    title: 'Asking ' + LanguageUtils.ucFirst(llm.modelType),
                    text: `Processing premises... 0/${total}`,
                    allowEscapeKey: false,
                    allowOutsideClick: false,
                    didOpen: () => {
                      Swal.showLoading()
                    }
                  })
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
                      // Update Swal text for conclusion phase
                      Swal.update({ text: 'Resolving the conclusion based on the premises...' })
                      const params = {
                        prompt: conclusionPrompt,
                        llm: llm,
                        apiKey: apiKey,
                        documents: documents,
                        callback: (json) => {
                          Swal.close()
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
                                let model = window.abwa.criteriaManager.model
                                let tag = [
                                  model.namespace + ':' + model.config.grouped.relation + ':' + answer.name
                                ]
                                CustomCriteriaManager.deleteTagAnnotations(tag, () => {
                                  LanguageUtils.dispatchCustomEvent(Events.annotateByLLM, {
                                    tags: tag,
                                    selectors: selectors,
                                    commentData: commentData
                                  })
                                })
                              }
                              // retrieve tag annotation
                              let data
                              let currentCriterionGroup = _.find(window.abwa.criteriaManager.currentCriterionGroups, currentTag => currentTag.config.name === answer.name)
                              let tagAnnotation = currentCriterionGroup.config.annotation
                              if (tagAnnotation.text) {
                                data = jsYaml.load(tagAnnotation.text)
                                // Check if data.assessments exists and is an array. If not, initialize it as an empty array.
                                if (!Array.isArray(data.assessments)) {
                                  data.assessments = []
                                }
                                let foundCompile = data.assessments.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
                                if (!foundCompile) {
                                  // Store answer as standardized object {statement, excerpt, sentiment}
                                  data.assessments.push({ document: window.abwa.contentTypeManager.pdfFingerprint, documentTitle: window.abwa.contentTypeManager.documentTitle || '', answer: { statement: answer.statement, excerpt: answer.excerpt, sentiment: answer.sentiment }, llm: llm.model })
                                } else {
                                  foundCompile.answer = { statement: answer.statement, excerpt: answer.excerpt, sentiment: answer.sentiment }
                                  foundCompile.llm = llm.model
                                }
                              }
                              tagAnnotation.text = jsYaml.dump(data)
                              tagAnnotations.push(tagAnnotation)
                            })
                          }
                          // Conclusion
                          let conclusionData
                          let conclusionTagGroup = _.find(window.abwa.criteriaManager.currentCriterionGroups, currentTag => currentTag.config.name === conclusion.name)
                          let conclusionAnnotation = conclusionTagGroup.config.annotation
                          if (conclusionAnnotation.text) {
                            conclusionData = jsYaml.load(conclusionAnnotation.text)
                            if (!Array.isArray(conclusionData.assessments)) {
                              conclusionData.assessments = []
                            }
                            let foundCompile = conclusionData.assessments.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
                            if (!foundCompile) {
                              conclusionData.assessments.push({ document: window.abwa.contentTypeManager.pdfFingerprint, documentTitle: window.abwa.contentTypeManager.documentTitle || '', answer: { statement: json.statement, sentiment: json.sentiment }, llm: llm.model })
                            } else {
                              foundCompile.answer = { statement: json.statement, sentiment: json.sentiment }
                              foundCompile.llm = llm.model
                            }
                          }
                          conclusionAnnotation.text = jsYaml.dump(conclusionData)
                          tagAnnotations.push(conclusionAnnotation)
                          // Single dispatch: save premises + conclusion together so reloadTags runs only once
                          LanguageUtils.dispatchCustomEvent(Events.updateCriteriaAnnotations, {annotations: tagAnnotations})
                          Alerts.successAlert({title: 'Available analysis', text: 'Premises completed'})
                        }
                      }
                      LLMClient.pdfBasedQuestionSilent(params)
                    })
                    .catch((error) => {
                      Swal.close()
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
                  callback: callback
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
        callback: (response) => {
          resolve(response)
        }
      }

      try {
        LLMClient.pdfBasedQuestionSilent(params)
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
        callback: (response) => {
          resolve(response)
        }
      }

      try {
        LLMClient.pdfBasedQuestionSilent(params)
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
        findFeedback = data.feedback.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
      }
    }
    if (findFeedback) {
      this.formulateCriticalQuestionWithFeedback(criterion, description, tagAnnotation, findFeedback, data, paragraphs)
    } else {
      // this.modifyCriteriaHandler(currentCriterionGroup)
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
                  let argument = json.argument
                  let counterargument = json.counterargument
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
                    let model = window.abwa.criteriaManager.model
                    let tag = [
                      model.namespace + ':' + model.config.grouped.relation + ':' + criterion
                    ]
                    CustomCriteriaManager.deleteTagAnnotations(tag, () => {
                      LanguageUtils.dispatchCustomEvent(Events.annotateByLLM, {
                        tags: tag,
                        selectors: selectors,
                        commentData: commentData
                      })
                    })
                  }
                  if (annotation.selectors.length === 0) {
                    CustomCriteriaManager.showParagraph(annotation, criterion)
                  } else {
                    CustomCriteriaManager.showAnnotatedParagraph(annotation, criterion)
                  }
                  // retrieve tag annotation
                  let data
                  if (tagAnnotation.text) {
                    data = jsYaml.load(tagAnnotation.text)
                    // Store in assessments (primary storage for Critical Questions per model)
                    if (!Array.isArray(data.assessments)) {
                      data.assessments = []
                    }
                    let foundAssessment = data.assessments.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
                    if (!foundAssessment) {
                      data.assessments.push({ document: window.abwa.contentTypeManager.pdfFingerprint, documentTitle: window.abwa.contentTypeManager.documentTitle || '', adaptedQuestion: question, answer: answer, excerpt: excerpt, argument: argument, counterargument: counterargument, llm: llm.model })
                    } else {
                      foundAssessment.adaptedQuestion = question
                      foundAssessment.answer = answer
                      foundAssessment.excerpt = excerpt
                      foundAssessment.argument = argument
                      foundAssessment.counterargument = counterargument
                      foundAssessment.llm = llm.model
                    }
                  }
                  tagAnnotation.text = jsYaml.dump(data)
                  LanguageUtils.dispatchCustomEvent(Events.updateCriteriaAnnotation, {annotation: tagAnnotation})
                  Alerts.successAlert({title: 'Saved', text: 'The text has been saved in the report'})
                }
                if (apiKey && apiKey !== '') {
                  chrome.runtime.sendMessage({ scope: 'prompt', cmd: 'getPrompt', data: {type: 'criticalQuestionPrompt'} }, ({ prompt }) => {
                    if (!prompt) {
                      prompt = Config.prompts.criticalQuestionPrompt
                    }
                    let scheme = ''
                    if (window.abwa.criteriaManager) {
                      let currentCriterionGroups = window.abwa.criteriaManager.currentCriterionGroups
                      // Retrieve Premises
                      let premises = currentCriterionGroups.filter(criterionGroup => {
                        return criterionGroup.config.options.group === 'Premises'
                      })
                      let conclusion
                      for (let i = 0; i < premises.length; i++) {
                        const premise = premises[i]
                        if (premise.config.name === 'Conclusion') {
                          conclusion = premise
                        } else {
                          scheme += premise.config.name.toUpperCase() + ' PREMISE: '
                          const premiseCompile = Array.isArray((premise.config.options.assessments || premise.config.options.compile)) ? (premise.config.options.assessments || premise.config.options.compile).find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel)) : null
                          if (premiseCompile && premiseCompile.answer) {
                            const answerText = premiseCompile.answer?.statement || premiseCompile.answer
                            scheme += answerText + '\n'
                          } else {
                            scheme += premise.config.options.description + '\n'
                          }
                        }
                      }
                      const conclusionCompile = Array.isArray((conclusion.config.options.assessments || conclusion.config.options.compile)) ? (conclusion.config.options.assessments || conclusion.config.options.compile).find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel)) : null
                      scheme += conclusion.config.name.toUpperCase() + ': '
                      if (conclusionCompile && conclusionCompile.answer) {
                        const conclusionText = conclusionCompile.answer?.statement || conclusionCompile.answer
                        scheme += conclusionText + '\n'
                      } else {
                        scheme += conclusion.config.options.description + '\n'
                      }
                    }
                    prompt = prompt.replaceAll('[C_DESCRIPTION]', description).replaceAll('[C_NAME]', criterion).replaceAll('[C_SCHEME]', scheme)
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
                    callback: callback
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
                    let argument = json.argument
                    let counterargument = json.counterargument
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
                      let model = window.abwa.criteriaManager.model
                      let tag = [
                        model.namespace + ':' + model.config.grouped.relation + ':' + criterion
                      ]
                      CustomCriteriaManager.deleteTagAnnotations(tag, () => {
                        LanguageUtils.dispatchCustomEvent(Events.annotateByLLM, {
                          tags: tag,
                          selectors: selectors,
                          commentData: commentData
                        })
                      })
                    }
                    if (annotation.selectors.length === 0) {
                      CustomCriteriaManager.showParagraph(annotation, criterion)
                    } else {
                      CustomCriteriaManager.showAnnotatedParagraph(annotation, criterion)
                    }
                    // retrieve tag annotation
                    let data
                    if (tagAnnotation.text) {
                      data = jsYaml.load(tagAnnotation.text)
                      data.feedback = []
                      // Store in assessments (primary storage for Critical Questions per model)
                      if (!Array.isArray(data.assessments)) {
                        data.assessments = []
                      }
                      let foundAssessment = data.assessments.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
                      if (!foundAssessment) {
                        data.assessments.push({ document: window.abwa.contentTypeManager.pdfFingerprint, documentTitle: window.abwa.contentTypeManager.documentTitle || '', adaptedQuestion: question, answer: answer, excerpt: excerpt, argument: argument, counterargument: counterargument, llm: llm.model })
                      } else {
                        foundAssessment.adaptedQuestion = question
                        foundAssessment.answer = answer
                        foundAssessment.excerpt = excerpt
                        foundAssessment.argument = argument
                        foundAssessment.counterargument = counterargument
                        foundAssessment.llm = llm.model
                      }
                    }
                    tagAnnotation.text = jsYaml.dump(data)
                    LanguageUtils.dispatchCustomEvent(Events.updateCriteriaAnnotation, { annotation: tagAnnotation })
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
                      if (window.abwa.criteriaManager) {
                        let currentCriterionGroups = window.abwa.criteriaManager.currentCriterionGroups
                        // Retrieve Premises
                        let premises = currentCriterionGroups.filter(criterionGroup => {
                          return criterionGroup.config.options.group === 'Premises'
                        })
                        let conclusion
                        for (let i = 0; i < premises.length; i++) {
                          const premise = premises[i]
                          if (premise.config.name === 'Conclusion') {
                            conclusion = premise
                          } else {
                            scheme += premise.config.name.toUpperCase() + ' PREMISE: '
                            const premiseCompile = Array.isArray((premise.config.options.assessments || premise.config.options.compile)) ? (premise.config.options.assessments || premise.config.options.compile).find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel)) : null
                            if (premiseCompile && premiseCompile.answer) {
                              const answerText = premiseCompile.answer?.statement || premiseCompile.answer
                              scheme += answerText + '\n'
                            } else {
                              scheme += premise.config.options.description + '\n'
                            }
                          }
                        }
                        const conclusionCompile = Array.isArray((conclusion.config.options.assessments || conclusion.config.options.compile)) ? (conclusion.config.options.assessments || conclusion.config.options.compile).find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel)) : null
                        scheme += conclusion.config.name.toUpperCase() + ': '
                        if (conclusionCompile && conclusionCompile.answer) {
                          const conclusionText = conclusionCompile.answer?.statement || conclusionCompile.answer
                          scheme += conclusionText + '\n'
                        } else {
                          scheme += conclusion.config.options.description + '\n'
                        }
                      }
                      prompt = prompt.replaceAll('[C_DESCRIPTION]', description).replaceAll('[C_NAME]', criterion).replaceAll('[C_SCHEME]', scheme)
                      if (addFeedback) {
                        let findStatement = previousAnswer.assessments.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
                        let findFullQuestion = previousAnswer.fullQuestion.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
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
                      callback: callback
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
          alertType: Alerts.alertType.question,
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
                  if (window.abwa.criteriaManager) {
                    let currentCriterionGroups = window.abwa.criteriaManager.currentCriterionGroups
                    // Retrieve Premises
                    let premises = currentCriterionGroups.filter(criterionGroup => {
                      return criterionGroup.config.options.group === 'Premises'
                    })
                    let conclusion
                    for (let i = 0; i < premises.length; i++) {
                      const premise = premises[i]
                      if (premise.config.name === 'Conclusion') {
                        conclusion = premise
                      } else {
                        scheme += premise.config.name.toUpperCase() + ' PREMISE: '
                        const premiseCompile = Array.isArray((premise.config.options.assessments || premise.config.options.compile)) ? (premise.config.options.assessments || premise.config.options.compile).find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel)) : null
                        if (premiseCompile && premiseCompile.answer) {
                          const answerText = premiseCompile.answer?.statement || premiseCompile.answer
                          scheme += answerText + '\n'
                        } else {
                          scheme += premise.config.options.description + '\n'
                        }
                      }
                    }
                    if (conclusion) {
                      const conclusionCompile = Array.isArray((conclusion.config.options.assessments || conclusion.config.options.compile)) ? (conclusion.config.options.assessments || conclusion.config.options.compile).find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel)) : null
                      scheme += conclusion.config.name.toUpperCase() + ': '
                      if (conclusionCompile && conclusionCompile.answer) {
                        const conclusionText = conclusionCompile.answer?.statement || conclusionCompile.answer
                        scheme += conclusionText + '\n'
                      } else {
                        scheme += conclusion.config.options.description + '\n'
                      }
                    }
                    // Retrieve CRITICAL QUESTIONS
                    let criticalQuestions = currentCriterionGroups.filter(criterionGroup => {
                      return criterionGroup.config.options.group === 'Critical questions'
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
                  const total = questionsObjects.length
                  let completed = 0
                  const promises = questionsObjects.map((questionElem) =>
                    this.askQuestionsLLM(prompt, scheme, questionElem, llm, apiKey, documents)
                      .then(result => {
                        completed++
                        Swal.update({ text: `Processing critical questions... ${completed}/${total}` })
                        return result
                      })
                  )
                  // Show a single persistent loading dialog for the entire batch
                  let Swal
                  if (document && document.head) {
                    Swal = require('sweetalert2')
                  }
                  Swal.fire({
                    title: 'Asking ' + LanguageUtils.ucFirst(llm.modelType),
                    text: `Processing critical questions... 0/${total}`,
                    allowEscapeKey: false,
                    allowOutsideClick: false,
                    didOpen: () => {
                      Swal.showLoading()
                    }
                  })
                  Promise.all(promises)
                    .then((responses) => {
                      Swal.close()
                      let tagAnnotations = []
                      if (responses.length > 0) {
                        responses.forEach(llmAnswer => {
                          let excerpt = llmAnswer.excerpt
                          let question = llmAnswer.adaptedQuestion
                          let answer = llmAnswer.answer
                          let argument = llmAnswer.argument
                          let counterargument = llmAnswer.counterargument
                          let selectors = this.getSelectorsFromLLM(excerpt, documents)
                          if (selectors.length > 0) {
                            let commentData = {
                              comment: '',
                              statement: answer,
                              llm: llm,
                              paragraph: excerpt
                            }
                            let model = window.abwa.criteriaManager.model
                            let tag = [
                              model.namespace + ':' + model.config.grouped.relation + ':' + llmAnswer.name
                            ]
                            CustomCriteriaManager.deleteTagAnnotations(tag, () => {
                              LanguageUtils.dispatchCustomEvent(Events.annotateByLLM, {
                                tags: tag,
                                selectors: selectors,
                                commentData: commentData
                              })
                            })
                          }
                          // retrieve tag annotation
                          let data
                          let currentCriterionGroup = _.find(window.abwa.criteriaManager.currentCriterionGroups, currentTag => currentTag.config.name === llmAnswer.name)
                          if (currentCriterionGroup) {
                            let tagAnnotation = currentCriterionGroup.config.annotation
                            if (tagAnnotation.text) {
                              data = jsYaml.load(tagAnnotation.text)
                              // Store answer in compile for backward compatibility (standardized format)
                              // Store in assessments (primary storage for Critical Questions per model)
                              if (!Array.isArray(data.assessments)) {
                                data.assessments = []
                              }
                              let foundAssessment = data.assessments.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
                              if (!foundAssessment) {
                                data.assessments.push({
                                  document: window.abwa.contentTypeManager.pdfFingerprint,
                                  adaptedQuestion: question,
                                  answer: answer,
                                  excerpt: excerpt,
                                  argument: argument,
                                  counterargument: counterargument,
                                  llm: llm.model
                                })
                              } else {
                                foundAssessment.adaptedQuestion = question
                                foundAssessment.answer = answer
                                foundAssessment.excerpt = excerpt
                                foundAssessment.argument = argument
                                foundAssessment.counterargument = counterargument
                                foundAssessment.llm = llm.model
                              }
                              tagAnnotation.text = jsYaml.dump(data)
                              tagAnnotations.push(tagAnnotation)
                            }
                          }
                        })
                      }
                      LanguageUtils.dispatchCustomEvent(Events.updateCriteriaAnnotations, {annotations: tagAnnotations})
                      Alerts.successAlert({title: 'Available analysis', text: 'Critical questions completed'})
                    })
                    .catch((error) => {
                      Swal.close()
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
                  callback: callback
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
        // Read from assessments (primary for CQs) or compile (fallback/premises)
        if (data.assessments) {
          let foundAssessment = data.assessments.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
          if (foundAssessment) {
            answer = foundAssessment
            question = foundAssessment
          }
        }
        // Backward compat: old format with separate fullQuestion array
        if (!question && data.fullQuestion) {
          question = data.fullQuestion.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
        }
        if (!answer && data.assessments) {
          let foundCompile = data.assessments.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
          if (foundCompile) {
            answer = foundCompile
          }
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
                    criterion: question.adaptedQuestion || question.fullQuestion || '',
                    annotation: annotation,
                    type: 'assessments',
                    llm: llm.model
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
                    if (window.abwa.criteriaManager) {
                      let currentCriterionGroups = window.abwa.criteriaManager.currentCriterionGroups
                      // Retrieve Premises
                      let premises = currentCriterionGroups.filter(criterionGroup => {
                        return criterionGroup.config.options.group === 'Premises'
                      })
                      let conclusion
                      for (let i = 0; i < premises.length; i++) {
                        const premise = premises[i]
                        if (premise.config.name === 'Conclusion') {
                          conclusion = premise
                        } else {
                          scheme += premise.config.name.toUpperCase() + ' PREMISE: '
                          const premiseCompile = Array.isArray((premise.config.options.assessments || premise.config.options.compile)) ? (premise.config.options.assessments || premise.config.options.compile).find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel)) : null
                          if (premiseCompile && premiseCompile.answer) {
                            const answerText = premiseCompile.answer?.statement || premiseCompile.answer
                            scheme += answerText + '\n'
                          } else {
                            scheme += premise.config.options.description + '\n'
                          }
                        }
                      }
                      const conclusionCompile = Array.isArray((conclusion.config.options.assessments || conclusion.config.options.compile)) ? (conclusion.config.options.assessments || conclusion.config.options.compile).find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel)) : null
                      scheme += conclusion.config.name.toUpperCase() + ': '
                      if (conclusionCompile && conclusionCompile.answer) {
                        const conclusionText = conclusionCompile.answer?.statement || conclusionCompile.answer
                        scheme += conclusionText + '\n'
                      } else {
                        scheme += conclusion.config.options.description + '\n'
                      }
                    }
                    const answerText = answer.answer?.statement || answer.answer
                    argumentsPrompt = argumentsPrompt.replaceAll('[C_QUESTION]', question.fullQuestion).replaceAll('[C_ANSWER]', answerText).replaceAll('[C_NAME]', criterion).replaceAll('[C_SCHEME]', scheme)
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
                    callback: callback
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
    return !!_.find(window.abwa.criteriaManager.currentCriterionGroups, (tag) => { return tag.config.name === name })
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

  static recap (currentCriterionGroup) {
    let criterion = currentCriterionGroup.config.name
    let tagGroupAnnotations
    let paragraphs = []
    if (window.abwa.contentAnnotator) {
      let annotations = window.abwa.contentAnnotator.allAnnotations
      // Mark as chosen annotated tags
      for (let i = 0; i < annotations.length; i++) {
        let model = window.abwa.criteriaManager.model
        let tag = model.namespace + ':' + model.config.grouped.relation + ':' + criterion
        tagGroupAnnotations = annotations.filter((annotation) => {
          return AnnotationUtils.hasATag(annotation, tag)
        })
      }
    }
    if (tagGroupAnnotations) {
      // Filter to only show annotations from the current LLM
      tagGroupAnnotations = CustomCriteriaManager.filterAnnotationsByCurrentLLM(tagGroupAnnotations)
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
            paragraphs.push('(page ' + pageSelector.page + '): ' + body.paragraph.replace(/(\r\n|\n|\r)/gm, ' '))
          } else {
            let fragmentTextSelector
            if (selectors) {
              fragmentTextSelector = selectors.find((selector) => {
                return selector.type === 'TextQuoteSelector'
              })
            }
            if (fragmentTextSelector) {
              paragraphs.push('(page ' + pageSelector.page + '): ' + fragmentTextSelector.exact.replace(/(\r\n|\n|\r)/gm, ' '))
            }
          }
        }
      }
    }
    let compile = ''
    // Read from new "assessments" field (or legacy "compile") for premise data
    const premiseSource = currentCriterionGroup.config.options.assessments || currentCriterionGroup.config.options.compile
    if (premiseSource && premiseSource !== '') {
      const currentLLM = window.abwa && window.abwa.currentLLMModel
      const findCompile = premiseSource.find((entry) => {
        return entry.document === window.abwa.contentTypeManager.pdfFingerprint
          && (!currentLLM || !entry.llm || entry.llm === currentLLM)
      })
      if (findCompile) {
        compile = findCompile
      }
    }
    let assessments = ''
    if (currentCriterionGroup.config.options.assessments && currentCriterionGroup.config.options.assessments !== '') {
      const currentLLM = window.abwa && window.abwa.currentLLMModel
      const findAssessment = currentCriterionGroup.config.options.assessments.find((a) => {
        return a.document === window.abwa.contentTypeManager.pdfFingerprint
          && (!currentLLM || !a.llm || a.llm === currentLLM)
      })
      if (findAssessment) {
        assessments = findAssessment
      }
    }
    let excerpt = ''
    if (currentCriterionGroup.config.options.group === 'Critical questions' && assessments && assessments.excerpt) {
      excerpt = assessments.excerpt
    } else if (currentCriterionGroup.config.options.llmExcerpt) {
      const findLLMExcerpt = currentCriterionGroup.config.options.llmExcerpt.find((excerpt) => {
        return excerpt.document === window.abwa.contentTypeManager.pdfFingerprint
      })
      if (findLLMExcerpt) {
        excerpt = findLLMExcerpt.excerpt
      }
    }
    let fullQuestion = ''
    if (currentCriterionGroup.config.options.group === 'Critical questions' && assessments && assessments.adaptedQuestion) {
      fullQuestion = assessments.adaptedQuestion
    } else if (currentCriterionGroup.config.options.fullQuestion && currentCriterionGroup.config.options.fullQuestion !== '') {
      // Backward compat: old format with separate fullQuestion array
      const findFullQuestion = currentCriterionGroup.config.options.fullQuestion.find((fq) => {
        return fq.document === window.abwa.contentTypeManager.pdfFingerprint
      })
      if (findFullQuestion) {
        fullQuestion = findFullQuestion.fullQuestion
      }
    }
    let feedback = ''
    let findFeedback
    if (Array.isArray(currentCriterionGroup.config.options.feedback) && currentCriterionGroup.config.options.feedback.length > 0) {
      findFeedback = currentCriterionGroup.config.options.feedback.find((feedback) => {
        return feedback.document === window.abwa.contentTypeManager.pdfFingerprint
      })
      if (findFeedback) {
        feedback = findFeedback.comment + ' - ' + findFeedback.rate
      }
    }
    let statement = ''
    if (currentCriterionGroup.config.options.group === 'Critical questions' && assessments && assessments.answer) {
      statement = assessments.answer
    } else if (compile && compile.answer && compile.answer.statement) {
      statement = compile.answer.statement
    } else if (compile && compile.answer) {
      statement = compile.answer
    }
    let sentiment = ''
    if (currentCriterionGroup.config.options.group === 'Critical questions' && assessments && assessments.answer) {
      // Critical questions don't have sentiment in assessments; keep empty
    } else if (compile && compile.answer && compile.answer.sentiment) {
      sentiment = compile.answer.sentiment
    }
    let llmModel = ''
    if (currentCriterionGroup.config.options.group === 'Critical questions' && assessments && assessments.llm) {
      llmModel = assessments.llm
    } else if (compile && compile.answer && compile.answer.llm) {
      llmModel = compile.answer.llm
    } else if (compile && compile.llm) {
      llmModel = compile.llm
    }
    if (compile || assessments || paragraphs.length > 0) {
      const redFace = chrome.runtime.getURL('/images/red.png')
      const yellowFace = chrome.runtime.getURL('/images/yellow.png')
      const greenFace = chrome.runtime.getURL('/images/green.png')
      let html = '<div width=900px style="text-align: justify;text-justify: inter-word">'
      if (sentiment) {
        html += `
        <h3>Sentiment:</h3>
        <div id="sentiment-container" style="width:800px; display:flex; gap:20px; align-items:center;">
          <img src="${redFace}" data-sentiment="red" style="height:35px; cursor:pointer; ${sentiment === 'red' ? 'border:4px solid red; border-radius:8px;' : ''}">
          <img src="${yellowFace}" data-sentiment="yellow" style="height:35px; cursor:pointer; ${sentiment === 'yellow' ? 'border:4px solid orange; border-radius:8px;' : ''}">
          <img src="${greenFace}" data-sentiment="green" style="height:35px; cursor:pointer; ${sentiment === 'green' ? 'border:4px solid green; border-radius:8px;' : ''}">
        </div><br/>
      `
      }
      if (compile) {
        html += '<h3>Description:</h3><div width=800px>' + currentCriterionGroup.config.options.description + '</div></br>'
      }
      if (currentCriterionGroup.config.options.fullQuestion || (assessments && assessments.adaptedQuestion)) {
        html += '<h3>Question:</h3><div width=800px>' + fullQuestion + '</div></br>'
      }
      if (compile.answer || (assessments && assessments.answer)) {
        html += '<h3>Statement:</h3><div width=800px>' + statement + '</div></br>'
      }
      if (llmModel) {
        html += '<h3>Model:</h3><div width=800px><em>' + llmModel + '</em></div></br>'
      }
      if (assessments && (assessments.argument || assessments.counterargument)) {
        html += '<table style="width:800px; border-collapse:collapse; margin-bottom:10px;">'
        html += '<tr><th style="border:1px solid #ddd; padding:8px; background:#f5f5f5; width:50%">Argument</th><th style="border:1px solid #ddd; padding:8px; background:#f5f5f5; width:50%">Counterargument</th></tr>'
        html += '<tr><td style="border:1px solid #ddd; padding:8px; vertical-align:top">' + (assessments.argument || '') + '</td><td style="border:1px solid #ddd; padding:8px; vertical-align:top">' + (assessments.counterargument || '') + '</td></tr>'
        html += '</table>'
      } else if (assessments && typeof assessments === 'string') {
        html += '<h3>Arguments:</h3><div width=800px>' + assessments.replaceAll('</br>-', '</br></br>-') + '</div></br>'
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
      const feedbackLabel = feedback ? 'Edit feedback' : 'Provide feedback'
      html += `<div style="text-align:right; margin-top:8px; padding-top:8px; border-top:1px solid #eee;">
        <button id="swal-feedback-btn" style="background:none;border:none;color:#3085d6;cursor:pointer;font-size:0.9em;text-decoration:underline;padding:0;">${feedbackLabel}</button>
      </div>`
      Alerts.criterionInfoAlert({
        title: 'Analysis: ' + criterion,
        text: html,
        confirmButtonText: 'Close',
        width: '900px',
        currentCriterionGroup: currentCriterionGroup,
        cancelCallback: () => {
          CustomCriteriaManager.provideFeedback(currentCriterionGroup, findFeedback)
        }
      })
    } else {
      Alerts.errorAlert({
        title: 'No assessed',
        text: 'You must assess this criteria. Highlight, resume or find alternatives for the criterion.'
      })
    }
  }

  static attachSentimentListeners (currentCriterionGroup, selected) {
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
    // Read from new "assessments" field (or legacy "compile")
    const sentimentSource = currentCriterionGroup.config.options.assessments || currentCriterionGroup.config.options.compile
    if (sentimentSource && sentimentSource !== '') {
      const findCompile = sentimentSource.find((entry) => {
        return entry.document === window.abwa.contentTypeManager.pdfFingerprint
      })
      if (findCompile) {
        compile = findCompile
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
        let model = window.abwa.criteriaManager.model
        let tag = model.namespace + ':' + model.config.grouped.relation + ':' + criterion
        tagGroupAnnotations = annotations.filter((annotation) => {
          return AnnotationUtils.hasATag(annotation, tag)
        })
      }
    }
    if (tagGroupAnnotations) {
      // Filter to only show annotations from the current LLM
      tagGroupAnnotations = CustomCriteriaManager.filterAnnotationsByCurrentLLM(tagGroupAnnotations)
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

  // Filter document annotations (highlights) to only show those created by the current LLM.
  // Manual annotations (no llm field) always pass through.
  static filterAnnotationsByCurrentLLM (annotations) {
    const currentLLM = window.abwa && window.abwa.currentLLMModel
    if (!currentLLM) return annotations
    if (!Array.isArray(annotations)) return annotations
    return annotations.filter(a => {
      if (!a.text) return true
      try {
        const parsed = typeof a.text === 'string' ? JSON.parse(a.text) : a.text
        if (!parsed.llm) return true
        return parsed.llm.model === currentLLM
      } catch (e) { return true }
    })
  }
}

export default CustomCriteriaManager
