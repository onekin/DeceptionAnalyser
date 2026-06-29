import _ from 'lodash'
import $ from 'jquery'
import jsYaml from 'js-yaml'
import LanguageUtils from '../utils/LanguageUtils'
import ColorUtils from '../utils/ColorUtils'
import Events from './Events'
import Config from '../Config'
import Criterion from './Criterion'
import CriterionGroup from './CriterionGroup'
import Alerts from '../utils/Alerts'
import AnnotationUtils from '../utils/AnnotationUtils'
import ImportSchema from '../exporter/ImportSchema'
import DefaultCriteria from '../model/schema/DefaultCriteria'
import Review from '../model/schema/Review'
import CustomCriteriaManager from './CustomCriteriaManager'

class CriteriaManager {
  /**
   * CriteriaManager handles sidebar criterion groups for review criteria and evidencing.
   * @param {string} namespace - annotation namespace for the current review schema
   * @param {Object} config - grouped config values, e.g. group / subgroup labels
   */
  constructor (namespace, config) {
    this.model = {
      documentAnnotations: [],
      groupAnnotations: [],
      namespace: namespace,
      config: config
    }
    this.currentCriterionGroups = []
    this.events = {}
  }

  /**
   * Initialize criteria manager: structure, event handlers, and criteria data.
   * @param {Function} callback
   */
  init (callback) {
    this.initCriteriaStructure(() => {
      this.initEventHandlers(() => {
        this.initAllCriteria(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    })
  }

  /**
   * Rebuild criteria UI and fire update event.
   * Used when groups change or configuration is reloaded.
   */
  reloadCriteria (callback) {
    // Remove criteria buttons for each container (evidencing)
    if (this.criteriaContainer && this.criteriaContainer.evidencing) {
      this.criteriaContainer.evidencing.innerHTML = ''
    }
    // Init criteria again and dispatch update event
    this.initAllCriteria(() => {
      LanguageUtils.dispatchCustomEvent(Events.criteriaUpdated, {criteria: this.currentCriterionGroups})
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  /**
   * Get all annotations for the current group that belong to this review namespace.
   * @param {Object} group - current group object
   * @param {Function} callback - function(err, annotations)
   */
  static getGroupAnnotations (group, callback) {
    let groupUrl = group.links ? group.links.html : group.url
    window.abwa.storageManager.client.searchAnnotations({
      url: groupUrl,
      order: 'asc'
    }, (err, annotations) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Retrieve annotations which have the review namespace prefix
        annotations = _.filter(annotations, (annotation) => {
          return AnnotationUtils.hasANamespace(annotation, Config.review.namespace)
        })
        if (_.isFunction(callback)) {
          callback(null, annotations)
        }
      }
    })
  }

  /**
   * Load sidebar criteria wrapper HTML and bind DOM container references.
   * @param {Function} callback
   */
  initCriteriaStructure (callback) {
    let tagWrapperUrl = chrome.runtime.getURL('pages/sidebar/tagWrapper.html')
    $.get(tagWrapperUrl, (html) => {
      $('#abwaSidebarContainer').append($.parseHTML(html))
      this.criteriaContainer = {evidencing: document.querySelector('#tagsEvidencing')}
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  /**
   * Initialize all criteria for the current group.
   * If no group annotations exist, generate default review schema annotations.
   * @param {Function} callback
   */
  initAllCriteria (callback) {
    CriteriaManager.getGroupAnnotations(window.abwa.groupSelector.currentGroup, (err, annotations) => {
      if (err) {
        Alerts.errorAlert({text: 'Unable to construct the highlighter. Please reload webpage and try it again.'})
      } else {
        // If no criteria exist yet, create default criteria schema in the group.
        let promise = Promise.resolve(annotations)
        if (annotations.length === 0) {
          promise = new Promise((resolve) => {
            if (!Alerts.isVisible()) {
              Alerts.loadingAlert({title: 'Configuration in progress', text: 'We are configuring everything to start reviewing.', position: Alerts.position.center})
            }
            // Build default review model from built-in criteria
            let review = Review.fromCriterias(DefaultCriteria.criteria)
            review.storageGroup = window.abwa.groupSelector.currentGroup
            Alerts.loadingAlert({title: 'Configuration in progress', text: 'We are configuring everything to start reviewing.', position: Alerts.position.center})
            ImportSchema.createConfigurationAnnotationsFromReview({
              review,
              callback: (err, annotations) => {
                if (err) {
                  Alerts.errorAlert({ text: 'There was an error when configuring Review&Go highlighter' })
                } else {
                  Alerts.closeAlert()
                  window.abwa.sidebar.openSidebar() // Notify user configuration is ready
                  resolve(annotations)
                }
              }
            })
          })
        }
        promise.then((annotations) => {
          // Keep annotations in model
          this.model.groupAnnotations = annotations
          // Convert raw annotation objects into CriterionGroup/Criterion items
          this.currentCriterionGroups = this.createCriteriaBasedOnAnnotations()
          // Render evidencing buttons into sidebar
          this.createCriteriaButtonsForEvidencing()
          if (_.isFunction(callback)) {
            callback()
          }
        })
      }
    })
  }

  /**
   * Create CriterionGroup and Criterion objects from group annotations.
   * 1. Extract group-level annotations (group config metadata)
   * 2. Assign colors to each group
   * 3. Add subgroup elements (actual criteria)
   * 4. Sort groups and criteria alphabetically / numerically
   */
  createCriteriaBasedOnAnnotations () {
    // Phase 1: Parse group annotations into CriterionGroup objects
    let criterionGroupsAnnotations = {}
    for (let i = 0; i < this.model.groupAnnotations.length; i++) {
      let groupCriterion = this.retrieveCriterionNameByPrefix(this.model.groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.group))
      if (groupCriterion) {
        criterionGroupsAnnotations[groupCriterion] = new CriterionGroup({
          name: groupCriterion,
          namespace: this.model.namespace,
          group: this.model.config.grouped.group,
          options: jsYaml.load(this.model.groupAnnotations[i].text),
          annotation: this.model.groupAnnotations[i]
        })
      }
    }
    // Phase 2: Assign a distinct color per group
    let colorsList = ColorUtils.getDifferentColors(Object.keys(criterionGroupsAnnotations).length)
    let array = _.toArray(criterionGroupsAnnotations)
    let colors = {}
    for (let i = 0; i < array.length; i++) {
      let criterionGroup = criterionGroupsAnnotations[array[i].config.name]
      let color = colorsList[i]
      colors[criterionGroup.config.name] = color
      criterionGroup.config.color = color
    }
    // Phase 3: Add subgroup criteria to their parent criterion group.
    for (let i = 0; i < this.model.groupAnnotations.length; i++) {
      let criteriaAnnotation = this.model.groupAnnotations[i]
      let criteriaName = this.retrieveCriterionNameByPrefix(criteriaAnnotation.tags, (this.model.namespace + ':' + this.model.config.grouped.subgroup))
      let groupBelongedTo = this.retrieveCriterionNameByPrefix(criteriaAnnotation.tags, (this.model.namespace + ':' + this.model.config.grouped.relation))
      if (criteriaName && groupBelongedTo) {
        if (_.isObject(criterionGroupsAnnotations[groupBelongedTo]) && _.isArray(criterionGroupsAnnotations[groupBelongedTo].criteria)) {
          let options = jsYaml.load(criteriaAnnotation.text)
          criterionGroupsAnnotations[groupBelongedTo].criteria.push(new Criterion({
            name: criteriaName,
            namespace: this.model.namespace,
            options: options || {},
            annotation: criteriaAnnotation,
            tags: [
              this.model.namespace + ':' + this.model.config.grouped.relation + ':' + groupBelongedTo,
              this.model.namespace + ':' + this.model.config.grouped.subgroup + ':' + criteriaName
            ]
          }, criterionGroupsAnnotations[groupBelongedTo]))
        }
      }
    }
    // Phase 4: Sort criteria belonging to each group and color them.
    criterionGroupsAnnotations = _.map(criterionGroupsAnnotations, (criterionGroup) => {
      if (_.isArray(criterionGroup.criteria) && _.has(criterionGroup.criteria[0], 'name') && _.isNaN(_.parseInt(criterionGroup.criteria[0].name))) {
        criterionGroup.criteria = _.sortBy(criterionGroup.criteria, 'name')
      } else {
        criterionGroup.criteria = _.sortBy(criterionGroup.criteria, (criterion) => _.parseInt(criterion.name))
      }
      return criterionGroup
    })
    criterionGroupsAnnotations = _.map(criterionGroupsAnnotations, (criterionGroup) => {
      if (criterionGroup.criteria.length > 0) {
        criterionGroup.criteria = _.map(criterionGroup.criteria, (criterion) => {
          criterion.options.color = colors[criterionGroup.config.name]
          criterion.color = colors[criterionGroup.config.name]
          return criterion
        })
      }
      return criterionGroup
    })
    // Phase 5: Return groups in ordered list by group name and group config label.
    criterionGroupsAnnotations = _.orderBy(criterionGroupsAnnotations, ['config.name'], ['asc'])
    return _.sortBy(criterionGroupsAnnotations, (criterionGroupAnnotation) => {
      return _.get(criterionGroupAnnotation, 'config.options.group').toLowerCase()
    })
  }

  /**
   * Clean up DOM and event handlers.
   */
  destroy () {
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
    $('#tagsWrapper').remove()
  }

  /**
   * Resolve a criterion name by prefix in annotation tags.
   * Example: 'review:grouped:subgroup:XYZ' with prefix 'review:grouped:subgroup' returns 'XYZ'.
   * @param {string[]} annotationTags
   * @param {string} prefix
   * @returns {string|null}
   */
  retrieveCriterionNameByPrefix (annotationTags, prefix) {
    for (let i = 0; i < annotationTags.length; i++) {
      if (_.startsWith(annotationTags[i].toLowerCase(), prefix.toLowerCase())) {
        return _.replace(annotationTags[i], prefix + ':', '')
      }
    }
    return null
  }

  /**
   * Expand or collapse a grouped button container in the sidebar.
   * @param {Event} event
   */
  collapseExpandGroupedButtonsHandler (event) {
    let tagGroup = event.target.parentElement
    if (tagGroup.getAttribute('aria-expanded') === 'true') {
      tagGroup.setAttribute('aria-expanded', 'false')
    } else {
      tagGroup.setAttribute('aria-expanded', 'true')
    }
  }

  /**
   * Render evidencing criterion buttons grouped by type (Premises, Critical questions, etc.).
   * Each group container can be expanded/collapsed and contains one button per criterion group.
   */
  createCriteriaButtonsForEvidencing () {
    this.criteriaContainer.evidencing.append(CriteriaManager.createGroupedButtons({name: 'Premises', groupHandler: this.collapseExpandGroupedButtonsHandler}))
    this.criteriaContainer.evidencing.append(CriteriaManager.createGroupedButtons({name: 'Critical questions', groupHandler: this.collapseExpandGroupedButtonsHandler}))
    // Insert buttons in each of the groups
    let arrayOfCriterionGroups = _.values(this.currentCriterionGroups)
    let conclusionButton, conclusionCriterionGroup
    for (let i = 0; i < arrayOfCriterionGroups.length; i++) {
      let criterionGroup = arrayOfCriterionGroups[i]
      let color
      if (criterionGroup.config.name === 'Conclusion') {
        color = 'grey'
        // Check new "assessments" field first, fall back to legacy "compile"
        const conclusionSource = criterionGroup.config.options.assessments || criterionGroup.config.options.compile
        if (conclusionSource) {
          const currentLLM = window.abwa && window.abwa.currentLLMModel
          let foundEntry = conclusionSource.find(item =>
            item.document === window.abwa.contentTypeManager.pdfFingerprint &&
            (!currentLLM || !item.llm || item.llm === currentLLM)
          )
          if (foundEntry) {
            const sentiment = foundEntry.answer?.sentiment || foundEntry.sentiment
            if (sentiment) {
              color = sentiment
            }
          }
        }
      } else {
        color = ColorUtils.setAlphaToColor(criterionGroup.config.color, 0.45)
      }
      let button = CriteriaManager.createButton({
        name: criterionGroup.config.name,
        color: color,
        description: criterionGroup.config.options.description,
        criterionGroup: criterionGroup,
        handler: (event) => {
          let tags = [
            this.model.namespace + ':' + this.model.config.grouped.relation + ':' + criterionGroup.config.name
          ]
          LanguageUtils.dispatchCustomEvent(Events.annotate, { tags: tags, chosen: event.target.dataset.chosen })
        }
      })
      // Insert in its corresponding group container
      if (criterionGroup.config.name !== 'Conclusion') {
        this.criteriaContainer.evidencing.querySelector('[title="' + criterionGroup.config.options.group + '"]').nextElementSibling.append(button)
      } else {
        conclusionCriterionGroup = criterionGroup
        conclusionButton = button
      }
    }
    if (conclusionButton && conclusionCriterionGroup) {
      const targetContainer = this.criteriaContainer.evidencing
        .querySelector('[title="' + conclusionCriterionGroup.config.options.group + '"]')
        .nextElementSibling

      targetContainer.append(document.createElement('br'))
      targetContainer.append(document.createElement('hr'))
      targetContainer.append(document.createElement('br'))
      targetContainer.append(conclusionButton)
    }
  }

  /**
   * Create a button element for a criterion group entry.
   * @param {Object} params - name/color/description/click handler/role/criterionGroup
   * @returns {HTMLElement} button
   */
  static createButton ({name, color = 'grey', description, handler, role, criterionGroup}) {
    let tagButtonTemplate = document.querySelector('#tagButtonTemplate')
    let tagButton = $(tagButtonTemplate.content.firstElementChild).clone().get(0)
    tagButton.innerText = name
    if (description) {
      tagButton.title = name + ': ' + description
    } else {
      tagButton.title = name
    }
    tagButton.dataset.mark = name
    tagButton.setAttribute('role', role || 'annotation')
    if (color) {
      $(tagButton).css('background-color', color)
      tagButton.dataset.baseColor = color
    }
    // Set handler for button
    tagButton.addEventListener('click', handler)
    // Add a double-click event listener to the button
    tagButton.addEventListener('dblclick', function () {
      if (criterionGroup) {
        let currentCriterionGroup = _.find(window.abwa.criteriaManager.currentCriterionGroups, currentCriterion => currentCriterion.config.annotation.id === criterionGroup.config.annotation.id)
        CustomCriteriaManager.modifyCriteriaHandler(currentCriterionGroup)
      }
    })


    return tagButton
  }

  /**
   * Create the grouped button section template used by evidencing groups.
   * Includes action buttons for multiple operations (e.g., annotate all premises).
   * @param {Object} params - name/color/elements/groupHandler/buttonHandler
   * @returns {HTMLElement} tagGroup container
   */
  static createGroupedButtons ({name, color = 'white', elements, groupHandler, buttonHandler}) {
    // Create the container
    let tagGroupTemplate = document.querySelector('#tagGroupTemplate')
    let tagGroup = $(tagGroupTemplate.content.firstElementChild).clone().get(0)
    let tagButtonContainer = $(tagGroup).find('.tagButtonContainer')
    let groupNameSpan = tagGroup.querySelector('.groupName')
    tagGroup.dataset.groupName = name
    groupNameSpan.innerText = name
    groupNameSpan.title = name
    // Create event handler for tag group
    // groupNameSpan.addEventListener
    // === Create the tools container dynamically === //
    let toolsContainer = document.createElement('div')
    toolsContainer.id = `${name}_tools_container`
    toolsContainer.className = 'bodyContainerButtons'

    // Create a wrapper div JUST for the tool buttons
    let toolButtonGroup = document.createElement('div')
    toolButtonGroup.style.display = 'flex'
    toolButtonGroup.style.flexDirection = 'row'
    toolButtonGroup.style.justifyContent = 'center'
    toolButtonGroup.style.alignItems = 'center'
    toolButtonGroup.style.gap = '6px'
    toolButtonGroup.style.margin = '4px 0'

    // Ask GPT button
    let askGptButton = document.createElement('img')
    askGptButton.id = 'askGptButton'
    askGptButton.className = 'toolButton'
    if (name === 'Premises') {
      askGptButton.alt = 'Annotate all premises'
      askGptButton.title = 'Annotate all premises'
    } else if (name === 'Critical questions') {
      askGptButton.alt = 'Formulate all critical questions'
      askGptButton.title = 'Formulate all critical questions'
    }
    let askGptButtonURL = chrome.runtime.getURL('/images/fraudDetection.png')
    askGptButton.src = askGptButtonURL // You can set a proper icon URL here
    askGptButton.addEventListener('click', () => {
      if (name === 'Premises') {
        window.abwa.specific.customCriteriaManager.annotateAllPremises(name)
      } else if (name === 'Critical questions') {
        let conclusionCriterionGroup = _.find(window.abwa.criteriaManager.currentCriterionGroups, criterionGroup => criterionGroup.config.name === 'Conclusion')
        // Check new "assessments" field first, fall back to legacy "compile"
        const conclusionSource = conclusionCriterionGroup && (conclusionCriterionGroup.config.options.assessments || conclusionCriterionGroup.config.options.compile)
        if (conclusionSource) {
          // check if it has the sentiment
          let foundEntry = conclusionSource.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
          const sentiment = foundEntry && (foundEntry.answer?.sentiment || foundEntry.sentiment)
          if (foundEntry && sentiment) {
            window.abwa.specific.customCriteriaManager.formulateAllCriticalQuestions(name)
          } else {
            Alerts.errorAlert({ title: 'Please draw the conclusions first' })
          }
        } else {
          Alerts.errorAlert({ title: 'Wait!', text: 'You have to draw the conclusions first in order to formulate the critical questions.' })
        }
      }
    })

    // Create New Button
    let createNewButton = document.createElement('img')
    createNewButton.id = 'createNewButton'
    createNewButton.className = 'toolButton'
    if (name === 'Premises') {
      createNewButton.alt = 'Create new premise'
      createNewButton.title = 'Create new premise'
    } else if (name === 'Critical questions') {
      createNewButton.alt = 'Create new critical question'
      createNewButton.title = 'Create new critical question'
    }
    createNewButton.alt = 'Create New Button'
    createNewButton.title = 'Create New Button'
    let createNewButtonURL = chrome.runtime.getURL('/images/add.png')
    createNewButton.src = createNewButtonURL // You can set a proper icon URL here
    createNewButton.addEventListener('click', () => {
      CustomCriteriaManager.createAddCustomCriteriaButtonHandler(name)
    })

    // Append buttons to the group
    toolButtonGroup.appendChild(askGptButton)
    toolButtonGroup.appendChild(createNewButton)

    // Add the group to the container
    toolsContainer.appendChild(toolButtonGroup)

    // Insert the tools container before the tagButtonContainer
    tagButtonContainer[0].parentNode.insertBefore(toolsContainer, tagButtonContainer[0])

    // Create buttons and add to the container
    if (_.isArray(elements) && elements.length > 0) { // Only create group containers for groups which have elements
      for (let i = 0; i < elements.length; i++) {
        let element = elements[i]
        if (element.name !== 'Conclusion') {
          let button = CriteriaManager.createButton({
            name: element.name,
            color: element.getColor(),
            description: (element.options.description || null),
            handler: buttonHandler,
            criterionGroup: tagGroup,
            role: 'marking'
          })
          tagButtonContainer.append(button)
        }
      }
    }
    return tagGroup
  }

  initEventHandlers (callback) {
    // For annotation event, reload sidebar with elements chosen and not chosen ones
    this.events.annotationCreated = {
      element: document,
      event: Events.annotationCreated,
      handler: (event) => { this.reloadCriteriaChosen() }
    }
    this.events.annotationCreated.element.addEventListener(this.events.annotationCreated.event, this.events.annotationCreated.handler, false)
    // For delete event, reload sidebar with elements chosen and not chosen ones
    this.events.annotationDeleted = {
      element: document,
      event: Events.annotationDeleted,
      handler: (event) => { this.reloadCriteriaChosen() }
    }
    this.events.annotationDeleted.element.addEventListener(this.events.annotationDeleted.event, this.events.annotationDeleted.handler, false)
    // When annotations are reloaded
    this.events.updatedAllAnnotations = {
      element: document,
      event: Events.updatedAllAnnotations,
      handler: (event) => { this.reloadCriteriaChosen() }
    }
    this.events.updatedAllAnnotations.element.addEventListener(this.events.updatedAllAnnotations.event, this.events.updatedAllAnnotations.handler, false)
    // Callback
    if (_.isFunction(callback)) {
      callback()
    }
  }

  reloadCriteriaChosen () {
    // Uncheck all the criteria
    const green = chrome.runtime.getURL('/images/green.png')
    const yellow = chrome.runtime.getURL('/images/yellow.png')
    const red = chrome.runtime.getURL('/images/red.png')
    const checkmark = chrome.runtime.getURL('/images/check.png')
    let tagButtons = document.querySelectorAll('.tagButton')
    for (let i = 0; i < tagButtons.length; i++) {
      let tagButton = tagButtons[i]
      tagButton.innerText = tagButton.innerText.replace(/\([^)]*\)|^\s/, '')
      tagButton.dataset.chosen = 'false'
      // Remove any existing analysis indicator
      tagButton.classList.remove('hasAnalysis')
      if (!tagButton.innerText.includes('Conclusion')) {
        tagButton.style.background = ColorUtils.setAlphaToColor(ColorUtils.colorFromString(tagButton.style.backgroundColor), 0.35)
        // Add image for Premises buttons that have sentiment but no annotations
        let criteriaName = tagButton.dataset.mark
        let criterionGroup = _.find(_.values(this.currentCriterionGroups), (cg) => { return cg.config.name === criteriaName })
        if (criterionGroup && (criterionGroup.config.options.assessments || criterionGroup.config.options.compile)) {
          let foundCompile = (criterionGroup.config.options.assessments || criterionGroup.config.options.compile).find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
          let sentiment
          if (foundCompile && foundCompile.answer && foundCompile.answer.sentiment) {
            sentiment = foundCompile.answer.sentiment
          } else if (foundCompile && foundCompile.sentiment) {
            sentiment = foundCompile.sentiment
          }

          if (sentiment) {
            // Create <img> element
            let img = document.createElement('img')
            switch (sentiment) {
              case 'green':
                img.src = green
                img.alt = 'Positive'
                break
              case 'yellow':
                img.src = yellow
                img.alt = 'Neutral'
                break
              case 'red':
                img.src = red
                img.alt = 'Negative'
                break
            }
            img.style.height = '16px'
            img.style.verticalAlign = 'middle'
            img.style.marginRight = '4px'
            // Add <img> to button
            tagButton.appendChild(img)
          }
        }
      } else {
        // If it is the conclusion criterion, set the background color to grey
        let arrayOfCriterionGroups = _.values(this.currentCriterionGroups)
        let conclusionSentiment
        let conclusionCriterion = _.find(arrayOfCriterionGroups, (criterionGroup) => { return criterionGroup.config.name === 'Conclusion' })
        if ((conclusionCriterion.config.options.assessments || conclusionCriterion.config.options.compile)) {
          let foundCompile = (conclusionCriterion.config.options.assessments || conclusionCriterion.config.options.compile).find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
          if (foundCompile && (foundCompile.answer?.sentiment || foundCompile.sentiment)) {
            conclusionSentiment = foundCompile.answer?.sentiment || foundCompile.sentiment
          }
          // Change to a darker color
          if (conclusionSentiment) {
            // Create <img> element
            let img = document.createElement('img')
            switch (conclusionSentiment) {
              case 'green':
                img.src = green
                img.alt = 'Thumbs up'
                break
              case 'yellow':
                img.src = yellow
                img.alt = 'Thumbs down'
                break
              case 'red':
                img.src = red
                img.alt = 'Thumbs down'
                break
            }
            img.alt = 'Thumbs up'
            img.style.height = '30px'
            img.style.verticalAlign = 'bottom'
            // Add <img> to button
            tagButton.appendChild(img)
          }
        }
      }
    }
    // Retrieve annotated criteria
    if (window.abwa.contentAnnotator) {
      let annotations = window.abwa.contentAnnotator.allAnnotations
      let annotatedCriterionGroups = []
      for (let i = 0; i < annotations.length; i++) {
        annotatedCriterionGroups.push(this.getGroupFromAnnotation(annotations[i]))
      }
      annotatedCriterionGroups = _.uniq(annotatedCriterionGroups)
      // Mark as chosen annotated criteria
      for (let i = 0; i < annotatedCriterionGroups.length; i++) {
        let model = window.abwa.criteriaManager.model
        let criterionGroup = annotatedCriterionGroups[i]
        if (criterionGroup) {
          let tag = model.namespace + ':' + model.config.grouped.relation + ':' + criterionGroup.config.name
          let numberOfAnnotations = annotations.filter((annotation) => {
            return AnnotationUtils.hasATag(annotation, tag)
          })
          // Filter to only count annotations from the current LLM
          const currentLLMModel = window.abwa && window.abwa.currentLLMModel
          if (currentLLMModel) {
            numberOfAnnotations = numberOfAnnotations.filter(a => {
              if (!a.text) return true
              try {
                const parsed = typeof a.text === 'string' ? JSON.parse(a.text) : a.text
                if (!parsed.llm) return true
                return parsed.llm.model === currentLLMModel
              } catch (e) { return true }
            })
          }
          let tagButton = this.criteriaContainer.evidencing.querySelector('.tagButton[data-mark="' + criterionGroup.config.name + '"]')
          tagButton.dataset.chosen = 'true'
          tagButton.innerText = '(' + numberOfAnnotations.length + ') ' + criterionGroup.config.name
          let sentiment
          if ((criterionGroup.config.options.assessments || criterionGroup.config.options.compile)) {
            let foundCompile = (criterionGroup.config.options.assessments || criterionGroup.config.options.compile).find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint && (!(window.abwa && window.abwa.currentLLMModel) || !item.llm || item.llm === window.abwa.currentLLMModel))
            if (foundCompile && foundCompile.answer && foundCompile.answer.sentiment) {
              sentiment = foundCompile.answer.sentiment
            }
          }
          // Change to a darker color
          if (sentiment) {
            // Create <img> element
            let img = document.createElement('img')
            switch (sentiment) {
              case 'green':
                img.src = green
                img.alt = 'Thumbs up'
                break
              case 'yellow':
                img.src = yellow
                img.alt = 'Thumbs down'
                break
              case 'red':
                img.src = red
                img.alt = 'Thumbs down'
                break
            }
            img.alt = 'Thumbs up'
            img.style.height = '16px'
            img.style.verticalAlign = 'middle'
            img.style.marginRight = '4px'
            // Add <img> to button
            tagButton.appendChild(img)
          }
          // Mark button as having analysis with stronger visual cues
          tagButton.classList.add('hasAnalysis')
          tagButton.style.background = ColorUtils.setAlphaToColor(ColorUtils.colorFromString(tagButton.style.backgroundColor), 0.85)
          tagButton.style.borderLeft = '4px solid ' + ColorUtils.setAlphaToColor(ColorUtils.colorFromString(tagButton.style.backgroundColor), 1.0)
          tagButton.style.fontWeight = '600'
        }
      }
    }
  }

  getFilteringCriteriaList () {
    return _.map(this.currentCriterionGroups, (criterionGroup) => {
      return this.getCriterionFromGroup(criterionGroup)
    })
  }

  getCriterionFromGroup (criterionGroup) {
    return this.model.namespace + ':' + this.model.config.grouped.relation + ':' + criterionGroup.config.name
  }

  findAnnotationCriterionInstance (annotation) {
    let groupCriterion = this.getGroupFromAnnotation(annotation)
    if (annotation.tags.length > 1) {
      if (this.hasCodeAnnotation(annotation)) {
        return this.getCodeFromAnnotation(annotation, groupCriterion)
      } else {
        return groupCriterion
      }
    } else {
      return groupCriterion
    }
  }

  getGroupFromAnnotation (annotation) {
    let tags = annotation.tags
    let criteriaTag = _.find(tags, (tag) => {
      return tag.includes('review:isCriteriaOf:')
    }).replace('review:isCriteriaOf:', '')
    return _.find(window.abwa.criteriaManager.currentCriterionGroups, (criterionGroupInstance) => {
      return criteriaTag === criterionGroupInstance.config.name
    })
  }

  getCodeFromAnnotation (annotation, groupCriterion) {
    let markCriterion = _.find(annotation.tags, (tag) => {
      return tag.includes('review:level:')
    }).replace('review:level:', '')
    return _.find(groupCriterion.criteria, (criterionInstance) => {
      return markCriterion.includes(criterionInstance.name)
    })
  }

  hasCodeAnnotation (annotation) {
    return _.some(annotation.tags, (tag) => {
      return tag.includes('review:level:')
    })
  }
}

export default CriteriaManager
