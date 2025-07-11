import _ from 'lodash'
import $ from 'jquery'
import jsYaml from 'js-yaml'
import LanguageUtils from '../utils/LanguageUtils'
import ColorUtils from '../utils/ColorUtils'
import Events from './Events'
import Config from '../Config'
import Tag from './Tag'
import TagGroup from './TagGroup'
import Alerts from '../utils/Alerts'
import AnnotationUtils from '../utils/AnnotationUtils'
import ImportSchema from '../specific/review/ImportSchema'
import DefaultCriteria from '../specific/review/DefaultCriteria'
import Review from '../model/schema/Review'
import CustomCriteriasManager from '../specific/review/CustomCriteriasManager'

class TagManager {
  constructor (namespace, config) {
    this.model = {
      documentAnnotations: [],
      groupAnnotations: [],
      namespace: namespace,
      config: config
    }
    this.currentTags = []
    this.events = {}
  }

  init (callback) {
    this.initTagsStructure(() => {
      this.initEventHandlers(() => {
        this.initAllTags(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    })
  }

  reloadTags (callback) {
    // Remove tags buttons for each container (evidencing, viewing)
    _.map(window.abwa.tagManager.tagsContainer).forEach((container) => { container.innerHTML = '' })
    // Init tags again
    this.initAllTags(() => {
      LanguageUtils.dispatchCustomEvent(Events.tagsUpdated, {tags: this.currentTags})
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

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
        // Retrieve tags which has the namespace
        annotations = _.filter(annotations, (annotation) => {
          return AnnotationUtils.hasANamespace(annotation, Config.review.namespace)
        })
        if (_.isFunction(callback)) {
          callback(null, annotations)
        }
      }
    })
  }

  initTagsStructure (callback) {
    let tagWrapperUrl = chrome.runtime.getURL('pages/sidebar/tagWrapper.html')
    $.get(tagWrapperUrl, (html) => {
      $('#abwaSidebarContainer').append($.parseHTML(html))
      this.tagsContainer = {evidencing: document.querySelector('#tagsEvidencing')}
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  initAllTags (callback) {
    TagManager.getGroupAnnotations(window.abwa.groupSelector.currentGroup, (err, annotations) => {
      if (err) {
        Alerts.errorAlert({text: 'Unable to construct the highlighter. Please reload webpage and try it again.'})
      } else {
        // Check if there are tags in the group or it is needed to create the default ones
        let promise = Promise.resolve(annotations) // TODO Check if it is okay
        if (annotations.length === 0) {
          promise = new Promise((resolve) => {
            if (!Alerts.isVisible()) {
              Alerts.loadingAlert({title: 'Configuration in progress', text: 'We are configuring everything to start reviewing.', position: Alerts.position.center})
            }
            // Create configuration into group
            // Create review schema from default criterias
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
                  window.abwa.sidebar.openSidebar() // Open sidebar to notify the user that the highlighter is created and ready to use
                  resolve(annotations)
                }
              }
            })
          })
        }
        promise.then((annotations) => {
          // Add to model
          this.model.groupAnnotations = annotations
          // Create tags based on annotations
          this.currentTags = this.createTagsBasedOnAnnotations()
          // Populate tags containers for the modes
          this.createTagsButtonsForEvidencing()
          if (_.isFunction(callback)) {
            callback()
          }
        })
      }
    })
  }

  createTagsBasedOnAnnotations () {
    // Get groups
    let tagGroupsAnnotations = {}
    for (let i = 0; i < this.model.groupAnnotations.length; i++) {
      let groupTag = this.retrieveTagNameByPrefix(this.model.groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.group))
      if (groupTag) {
        tagGroupsAnnotations[groupTag] = new TagGroup({name: groupTag, namespace: this.model.namespace, group: this.model.config.grouped.group, options: jsYaml.load(this.model.groupAnnotations[i].text), annotation: this.model.groupAnnotations[i]})
      }
    }
    // Get groups names
    // The list of colors to retrieve are 1 per group + 1 per groupTags in "Other" group
    let colorsList = ColorUtils.getDifferentColors(Object.keys(tagGroupsAnnotations).length)
    // Set colors for each group
    let array = _.toArray(tagGroupsAnnotations)
    let colors = {}
    for (let i = 0; i < array.length; i++) {
      let tagGroup = tagGroupsAnnotations[array[i].config.name]
      let color
      color = colorsList[i]
      colors[tagGroup.config.name] = color
      tagGroup.config.color = color
    }
    // Get elements for each subgroup
    for (let i = 0; i < this.model.groupAnnotations.length; i++) {
      let tagAnnotation = this.model.groupAnnotations[i]
      let tagName = this.retrieveTagNameByPrefix(this.model.groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.subgroup))
      let groupBelongedTo = this.retrieveTagNameByPrefix(this.model.groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.relation))
      if (tagName && groupBelongedTo) {
        if (_.isObject(tagGroupsAnnotations[groupBelongedTo]) && _.isArray(tagGroupsAnnotations[groupBelongedTo].tags)) {
          // Load options from annotation text body
          let options = jsYaml.load(tagAnnotation.text)
          tagGroupsAnnotations[groupBelongedTo].tags.push(new Tag({
            name: tagName,
            namespace: this.model.namespace,
            options: options || {},
            annotation: tagAnnotation,
            tags: [
              this.model.namespace + ':' + this.model.config.grouped.relation + ':' + groupBelongedTo,
              this.model.namespace + ':' + this.model.config.grouped.subgroup + ':' + tagName]
          }, tagGroupsAnnotations[groupBelongedTo]))
        }
      }
    }
    // Order elements from tag group
    // TODO Check if in this case is important to order elements from group
    tagGroupsAnnotations = _.map(tagGroupsAnnotations, (tagGroup) => {
      // TODO Check all elements, not only tags[0]
      if (_.isArray(tagGroup.tags) && _.has(tagGroup.tags[0], 'name') && _.isNaN(_.parseInt(tagGroup.tags[0].name))) {
        tagGroup.tags = _.sortBy(tagGroup.tags, 'name')
      } else {
        tagGroup.tags = _.sortBy(tagGroup.tags, (tag) => _.parseInt(tag.name))
      }
      return tagGroup
    })
    // Set color for each code
    tagGroupsAnnotations = _.map(tagGroupsAnnotations, (tagGroup) => {
      if (tagGroup.tags.length > 0) {
        tagGroup.tags = _.map(tagGroup.tags, (tag, index) => {
          // let color = ColorUtils.setAlphaToColor(colors[tagGroup.config.name])
          tag.options.color = colors[tagGroup.config.name]
          tag.color = colors[tagGroup.config.name]
          return tag
        })
      }
      return tagGroup
    })
    // Hash to array
    tagGroupsAnnotations = _.orderBy(tagGroupsAnnotations, ['config.name'], ['asc']) // 'asc' for ascending order
    return _.sortBy(tagGroupsAnnotations, (tagGroupAnnotation) => { return _.get(tagGroupAnnotation, 'config.options.group').toLowerCase() })
  }

  destroy () {
    // Remove event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
    // Remove tags wrapper
    $('#tagsWrapper').remove()
  }

  retrieveTagNameByPrefix (annotationTags, prefix) {
    for (let i = 0; i < annotationTags.length; i++) {
      if (_.startsWith(annotationTags[i].toLowerCase(), prefix.toLowerCase())) {
        return _.replace(annotationTags[i], prefix + ':', '')
      }
    }
    return null
  }

  collapseExpandGroupedButtonsHandler (event) {
    let tagGroup = event.target.parentElement
    if (tagGroup.getAttribute('aria-expanded') === 'true') {
      tagGroup.setAttribute('aria-expanded', 'false')
    } else {
      tagGroup.setAttribute('aria-expanded', 'true')
    }
  }

  createTagsButtonsForEvidencing () {
    // let groups = _.map(_.uniqBy(_.values(this.currentTags), (criteria) => { return criteria.config.options.group }), 'config.options.group')
    /* for (let i = 0; i < groups.length; i++) {
      let group = groups[i]
      this.tagsContainer.evidencing.append(TagManager.createGroupedButtons({name: group, groupHandler: this.collapseExpandGroupedButtonsHandler}))
    } */
    this.tagsContainer.evidencing.append(TagManager.createGroupedButtons({name: 'Premises', groupHandler: this.collapseExpandGroupedButtonsHandler}))
    this.tagsContainer.evidencing.append(TagManager.createGroupedButtons({name: 'Critical questions', groupHandler: this.collapseExpandGroupedButtonsHandler}))
    // Insert buttons in each of the groups
    let arrayOfTagGroups = _.values(this.currentTags)
    let conclusionButton, conclusionTagGroup
    for (let i = 0; i < arrayOfTagGroups.length; i++) {
      let tagGroup = arrayOfTagGroups[i]
      let color
      if (tagGroup.config.name === 'Conclusion') {
        color = 'grey'
        if (tagGroup.config.options.compile) {
          let foundCompile = tagGroup.config.options.compile.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
          if (foundCompile && foundCompile.sentiment) {
            color = foundCompile.sentiment
          }
        }
      } else {
        color = ColorUtils.setAlphaToColor(tagGroup.config.color, 0.45)
      }
      let button = TagManager.createButton({
        name: tagGroup.config.name,
        color: color,
        description: tagGroup.config.options.description,
        tagGroup: tagGroup,
        handler: (event) => {
          let tags = [
            this.model.namespace + ':' + this.model.config.grouped.relation + ':' + tagGroup.config.name
          ]
          LanguageUtils.dispatchCustomEvent(Events.annotate, { tags: tags, chosen: event.target.dataset.chosen })
        }
      })
      // Insert in its corresponding group container
      if (tagGroup.config.name !== 'Conclusion') {
        this.tagsContainer.evidencing.querySelector('[title="' + tagGroup.config.options.group + '"]').nextElementSibling.append(button)
      } else {
        conclusionTagGroup = tagGroup
        conclusionButton = button
      }
    }
    if (conclusionButton && conclusionTagGroup) {
      const targetContainer = this.tagsContainer.evidencing
        .querySelector('[title="' + conclusionTagGroup.config.options.group + '"]')
        .nextElementSibling

      targetContainer.append(document.createElement('br'))
      targetContainer.append(document.createElement('hr'))
      targetContainer.append(document.createElement('br'))
      targetContainer.append(conclusionButton)
      // this.tagsContainer.evidencing.querySelector('[title="' + conclusionTagGroup.config.options.group + '"]').nextElementSibling.append(conclusionButton)
      // document.querySelector('[data-group-name="Premises"]').append(conclusionButton)
      /* const premisesElement = document.querySelector('[data-group-name="Premises"]')
      if (premisesElement && premisesElement.parentNode) {
        conclusionButton.classList.add('conclusionButton')
        premisesElement.parentNode.insertBefore(conclusionButton, premisesElement)
      } */
    }
  }

  static createButton ({name, color = 'grey', description, handler, role, tagGroup}) {
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
    // Tag button background color change
    // TODO It should be better to set it as a CSS property, but currently there is not an option for that
    /*
    tagButton.addEventListener('mouseenter', () => {
      tagButton.style.backgroundColor = ColorUtils.setAlphaToColor(ColorUtils.colorFromString(color), 0.6)
    })
    */
    // Add a double-click event listener to the button
    tagButton.addEventListener('dblclick', function () {
      if (tagGroup) {
        let currentTagGroup = _.find(window.abwa.tagManager.currentTags, currentTag => currentTag.config.annotation.id === tagGroup.config.annotation.id)
        CustomCriteriasManager.modifyCriteriaHandler(currentTagGroup)
        // console.log('this.modifyCriteriaHandler(currentTagGroup)')
      }
    })
    /*
    tagButton.addEventListener('mouseleave', () => {
      if (tagButton.dataset.chosen === 'true') {
        tagButton.style.backgroundColor = ColorUtils.setAlphaToColor(ColorUtils.colorFromString(color), 0.45)
      } else {
        tagButton.style.backgroundColor = color
      }
    })
    */
    return tagButton
  }

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
        window.abwa.specific.customCriteriasManager.annotateAllPremises(name)
      } else if (name === 'Critical questions') {
        let conclusionTagGroup = _.find(window.abwa.tagManager.currentTags, tagGroup => tagGroup.config.name === 'Conclusion')
        if (conclusionTagGroup && conclusionTagGroup.config.options.compile) {
          // check if it has the sentiment
          let foundCompile = conclusionTagGroup.config.options.compile.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
          if (foundCompile && foundCompile.sentiment) {
            window.abwa.specific.customCriteriasManager.formulateAllCriticalQuestions(name)
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
      // TODO: Implement the logic for creating a new tag
      CustomCriteriasManager.createAddCustomCriteriaButtonHandler(name)
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
          let button = TagManager.createButton({
            name: element.name,
            color: element.getColor(),
            description: (element.options.description || null),
            handler: buttonHandler,
            tagGroup: tagGroup,
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
      handler: (event) => { this.reloadTagsChosen() }
    }
    this.events.annotationCreated.element.addEventListener(this.events.annotationCreated.event, this.events.annotationCreated.handler, false)
    // For delete event, reload sidebar with elements chosen and not chosen ones
    this.events.annotationDeleted = {
      element: document,
      event: Events.annotationDeleted,
      handler: (event) => { this.reloadTagsChosen() }
    }
    this.events.annotationDeleted.element.addEventListener(this.events.annotationDeleted.event, this.events.annotationDeleted.handler, false)
    // When annotations are reloaded
    this.events.updatedAllAnnotations = {
      element: document,
      event: Events.updatedAllAnnotations,
      handler: (event) => { this.reloadTagsChosen() }
    }
    this.events.updatedAllAnnotations.element.addEventListener(this.events.updatedAllAnnotations.event, this.events.updatedAllAnnotations.handler, false)
    // Callback
    if (_.isFunction(callback)) {
      callback()
    }
  }

  reloadTagsChosen () {
    // Uncheck all the tags
    const green = chrome.runtime.getURL('/images/green.png')
    const yellow = chrome.runtime.getURL('/images/yellow.png')
    const red = chrome.runtime.getURL('/images/red.png')
    let tagButtons = document.querySelectorAll('.tagButton')
    for (let i = 0; i < tagButtons.length; i++) {
      let tagButton = tagButtons[i]
      tagButton.innerText = tagButton.innerText.replace(/\([^)]*\)|^\s/, '')
      tagButton.dataset.chosen = 'false'
      if (!tagButton.innerText.includes('Conclusion')) {
        tagButton.style.background = ColorUtils.setAlphaToColor(ColorUtils.colorFromString(tagButton.style.backgroundColor), 0.45)
        // Add image for Premises buttons that have sentiment but no annotations
        let tagName = tagButton.dataset.mark
        let tagGroup = _.find(_.values(this.currentTags), (tg) => { return tg.config.name === tagName })
        if (tagGroup && tagGroup.config.options.compile) {
          let foundCompile = tagGroup.config.options.compile.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
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
        // If it is the conclusion tag, set the background color to grey
        let arrayOfTagGroups = _.values(this.currentTags)
        let conclusionSentiment
        let conclusionTag = _.find(arrayOfTagGroups, (tagGroup) => { return tagGroup.config.name === 'Conclusion' })
        if (conclusionTag.config.options.compile) {
          let foundCompile = conclusionTag.config.options.compile.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
          if (foundCompile && foundCompile.sentiment) {
            conclusionSentiment = foundCompile.sentiment
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
    // Retrieve annotated tags
    if (window.abwa.contentAnnotator) {
      let annotations = window.abwa.contentAnnotator.allAnnotations
      let annotatedTagGroups = []
      for (let i = 0; i < annotations.length; i++) {
        annotatedTagGroups.push(this.getGroupFromAnnotation(annotations[i]))
      }
      annotatedTagGroups = _.uniq(annotatedTagGroups)
      // Mark as chosen annotated tags
      for (let i = 0; i < annotatedTagGroups.length; i++) {
        let model = window.abwa.tagManager.model
        let tagGroup = annotatedTagGroups[i]
        if (tagGroup) {
          let tag = model.namespace + ':' + model.config.grouped.relation + ':' + tagGroup.config.name
          let numberOfAnnotations = annotations.filter((annotation) => {
            return AnnotationUtils.hasATag(annotation, tag)
          })
          let tagButton = this.tagsContainer.evidencing.querySelector('.tagButton[data-mark="' + tagGroup.config.name + '"]')
          tagButton.dataset.chosen = 'true'
          tagButton.innerText = '(' + numberOfAnnotations.length + ') ' + tagGroup.config.name
          // tagButton.innerText = tagGroup.config.name
          let sentiment
          if (tagGroup.config.options.compile) {
            let foundCompile = tagGroup.config.options.compile.find(item => item.document === window.abwa.contentTypeManager.pdfFingerprint)
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
          tagButton.style.background = ColorUtils.setAlphaToColor(ColorUtils.colorFromString(tagButton.style.backgroundColor), 0.6)
        }
      }
    }
  }

  getFilteringTagList () {
    return _.map(this.currentTags, (tagGroup) => {
      return this.getTagFromGroup(tagGroup)
    })
  }

  getTagFromGroup (tagGroup) {
    return this.model.namespace + ':' + this.model.config.grouped.relation + ':' + tagGroup.config.name
  }

  findAnnotationTagInstance (annotation) {
    let groupTag = this.getGroupFromAnnotation(annotation)
    if (annotation.tags.length > 1) {
      if (this.hasCodeAnnotation(annotation)) {
        return this.getCodeFromAnnotation(annotation, groupTag)
      } else {
        return groupTag
      }
    } else {
      return groupTag
    }
  }

  getGroupFromAnnotation (annotation) {
    let tags = annotation.tags
    let criteriaTag = _.find(tags, (tag) => {
      return tag.includes('review:isCriteriaOf:')
    }).replace('review:isCriteriaOf:', '')
    return _.find(window.abwa.tagManager.currentTags, (tagGroupInstance) => {
      return criteriaTag === tagGroupInstance.config.name
    })
  }

  getCodeFromAnnotation (annotation, groupTag) {
    let markTag = _.find(annotation.tags, (tag) => {
      return tag.includes('review:level:')
    }).replace('review:level:', '')
    return _.find(groupTag.tags, (tagInstance) => {
      return markTag.includes(tagInstance.name)
    })
  }

  hasCodeAnnotation (annotation) {
    return _.some(annotation.tags, (tag) => {
      return tag.includes('review:level:')
    })
  }
}

export default TagManager
