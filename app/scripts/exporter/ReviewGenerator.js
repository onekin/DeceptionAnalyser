/* eslint-disable */

import Config from '../Config'
import Alerts from '../utils/Alerts'
import AnnotationUtils from '../utils/AnnotationUtils'
import LocalStorageManager from '../storage/local/LocalStorageManager'
import jsYaml from 'js-yaml'


const axios = require('axios')
const _ = require('lodash')
const LanguageUtils = require('../utils/LanguageUtils')
const $ = require('jquery')
require('jquery-contextmenu/dist/jquery.contextMenu')
const {ReviewReport, AssessedTag, Annotation} = require('./reviewModel.js')
const FileSaver = require('file-saver')
const Events = require('../contentScript/Events')

let Swal = null
if (document && document.head) {
  Swal = require('sweetalert2')
}

class ReviewGenerator {
  init (callback) {
    // Create generator button
    let generatorWrapperURL = chrome.runtime.getURL('pages/specific/review/generator.html')
    axios.get(generatorWrapperURL).then((response) => {
      document.querySelector('#abwaSidebarContainer').insertAdjacentHTML('afterbegin', response.data)
      this.container = document.querySelector('#reviewGenerator')
      // HTML export button
      let htmlIconURL = chrome.runtime.getURL('/images/generator.png')
      this.htmlExportBtn = this.container.querySelector('#htmlExportButton')
      this.htmlExportBtn.src = htmlIconURL
      this.htmlExportBtn.addEventListener('click', () => {
        this.generateReviewByCategory(Config.exportScope.ALL_DOCS_ALL_LLM)
      })
      // CSV/Excel export button — use inline SVG if excel.png is missing
      let csvIconURL = chrome.runtime.getURL('/images/excel.png')
      this.csvExportBtn = this.container.querySelector('#csvExportButton')
      this.csvExportBtn.src = csvIconURL
      this.csvExportBtn.onerror = function () {
        // Fallback: inline spreadsheet SVG icon
        this.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>')
        this.onerror = null
      }
      this.csvExportBtn.addEventListener('click', () => {
        this.generateSpreadsheetButtonHandler()
      })
      // Set configuration button
      let configurationImageURL = chrome.runtime.getURL('/images/configuration.png')
      this.configurationImage = this.container.querySelector('#configurationButton')
      this.configurationImage.src = configurationImageURL
      this.configurationImage.addEventListener('click', () => {
        this.configurationButtonHandler()
      })
      // New schema button
      this.newSchemaImage = this.container.querySelector('#newSchemaButton')
      this.newSchemaImage.addEventListener('click', () => {
        this.newSchemaButtonHandler()
      })
      // LLM indicator
      this.llmIndicator = this.container.querySelector('#llmIndicator')
      this.llmModelName = this.container.querySelector('#llmModelName')
      this.llmApiKeyDot = this.container.querySelector('#llmApiKeyDot')
      this.llmDropdownArrow = this.container.querySelector('#llmDropdownArrow')
      this.llmConfigBtn = this.container.querySelector('#llmConfigBtn')
      this.llmModelDropdown = this.container.querySelector('#llmModelDropdown')
      this.updateLLMIndicator()
      // Refresh LLM indicator when user returns to this tab (e.g. after changing LLM in options)
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.updateLLMIndicator()
        }
      })
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  updateLLMIndicator () {
    chrome.runtime.sendMessage({ scope: 'llm', cmd: 'getSelectedLLM' }, ({ llm }) => {
      const newModel = (llm && llm.model) ? llm.model : null
      if (llm && llm.model) {
        this.llmIndicator.style.display = 'block'
        this.llmModelName.textContent = llm.model
        // Store full LLM object for dropdown use
        window.abwa._selectedLLM = llm
        // Check API key status and update dot color
        chrome.runtime.sendMessage({ scope: 'llm', cmd: 'getAPIKEY', data: llm.modelType }, ({ apiKey }) => {
          if (apiKey && apiKey !== '') {
            this.llmApiKeyDot.style.backgroundColor = '#4caf50' // green
            this.llmApiKeyDot.title = 'API key configured'
            this.llmConfigBtn.style.display = 'none'
          } else {
            this.llmApiKeyDot.style.backgroundColor = '#f44336' // red
            this.llmApiKeyDot.title = 'No API key configured — click ⚙ to set one'
            this.llmConfigBtn.style.display = 'inline-block'
          }
        })
        // Attach click handlers for model selector
        this.llmModelName.onclick = () => this.toggleModelDropdown()
        this.llmDropdownArrow.onclick = () => this.toggleModelDropdown()
        this.llmConfigBtn.onclick = () => {
          window.open(chrome.runtime.getURL('pages/options.html'))
        }
      } else {
        this.llmIndicator.style.display = 'none'
      }
      const previousModel = window.abwa.currentLLMModel
      window.abwa.currentLLMModel = newModel
      // Reload criteria if model actually changed (not on every initContextMenu call)
      if (previousModel !== newModel && window.abwa.criteriaManager) {
        window.abwa.criteriaManager.reloadCriteria()
      }
    })
  }

  buildModelDropdown () {
    const models = Config.llmModels
    const labels = Config.llmProviderLabels
    const currentLLM = window.abwa._selectedLLM
    let html = ''
    for (const [provider, providerModels] of Object.entries(models)) {
      html += `<div class="llm-dropdown-provider">${labels[provider] || provider}</div>`
      for (const m of providerModels) {
        const isSelected = currentLLM && currentLLM.modelType === provider && currentLLM.model === m.value
        html += `<div class="llm-dropdown-item${isSelected ? ' selected' : ''}"
          data-provider="${provider}"
          data-model="${m.value}"
          data-label="${m.label}">${m.label}${isSelected ? ' ✓' : ''}</div>`
      }
    }
    this.llmModelDropdown.innerHTML = html
    // Attach click handlers to items
    this.llmModelDropdown.querySelectorAll('.llm-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation()
        const provider = item.dataset.provider
        const model = item.dataset.model
        this.selectModel(provider, model)
        this.llmModelDropdown.style.display = 'none'
      })
    })
  }

  toggleModelDropdown () {
    if (this.llmModelDropdown.style.display === 'block') {
      this.llmModelDropdown.style.display = 'none'
      return
    }
    this.buildModelDropdown()
    this.llmModelDropdown.style.display = 'block'
    // Close dropdown when clicking outside
    const closeHandler = (e) => {
      if (!this.llmIndicator.contains(e.target)) {
        this.llmModelDropdown.style.display = 'none'
        document.removeEventListener('click', closeHandler)
      }
    }
    setTimeout(() => document.addEventListener('click', closeHandler), 0)
  }

  selectModel (provider, model) {
    chrome.runtime.sendMessage({
      scope: 'llm',
      cmd: 'setSelectedLLM',
      data: { llm: { modelType: provider, model: model } }
    }, () => {
      this.updateLLMIndicator()
    })
  }

  static getCurrentLLMModel (callback) {
    chrome.runtime.sendMessage({ scope: 'llm', cmd: 'getSelectedLLM' }, ({ llm }) => {
      if (llm && llm.model) {
        callback(llm.model)
      } else {
        callback(null)
      }
    })
  }

  // Filter an assessments/compile array to only show entries matching the current LLM.
  // If no LLM is selected, returns the original array (show all).
  static filterByCurrentLLM (entries) {
    if (!window.abwa || !window.abwa.currentLLMModel) return entries
    if (!Array.isArray(entries)) return entries
    return entries.filter(e => !e.llm || e.llm === window.abwa.currentLLMModel)
  }

  // Filter document annotations (highlights) to only show those created by the current LLM.
  // Manual annotations (no llm field) always pass through.
  static filterAnnotationsByCurrentLLM (annotations) {
    if (!window.abwa || !window.abwa.currentLLMModel) return annotations
    if (!Array.isArray(annotations)) return annotations
    return annotations.filter(a => {
      if (!a.text) return true
      try {
        const parsed = typeof a.text === 'string' ? JSON.parse(a.text) : a.text
        if (!parsed.llm) return true
        return parsed.llm.model === window.abwa.currentLLMModel
      } catch (e) { return true }
    })
  }
  parseAnnotations (annotations, scope = Config.exportScope.CURRENT_DOC_CURRENT_LLM) {
    const filterByDoc = (scope === Config.exportScope.CURRENT_DOC_CURRENT_LLM || scope === Config.exportScope.CURRENT_DOC_ALL_LLM)
    const filterByLLM = (scope === Config.exportScope.CURRENT_DOC_CURRENT_LLM || scope === Config.exportScope.ALL_DOCS_CURRENT_LLM)
    const currentDoc = window.abwa.contentTypeManager.pdfFingerprint
    const currentLLM = window.abwa && window.abwa.currentLLMModel

    // Build a complete docFingerprint → friendly label map from the entire annotations DB
    const docLabelMap = {}
    if (window.abwa.storageManager && window.abwa.storageManager.annotationsDatabase) {
      const db = window.abwa.storageManager.annotationsDatabase
      if (db.annotations) {
        db.annotations.forEach(ann => {
          const fp = ann.document && ann.document.documentFingerprint
          if (!fp || docLabelMap[fp]) return // already resolved
          // 1) Title from annotation document
          if (ann.document.title && ann.document.title.length > 0) {
            docLabelMap[fp] = ann.document.title
            return
          }
          // 2) Local file name
          const localFile = (ann.document.link || []).find(l => l.type === 'localfile')
          if (localFile) {
            try {
              docLabelMap[fp] = decodeURIComponent(new URL(localFile.href).pathname.split('/').pop())
              return
            } catch (e) { /* keep going */ }
          }
        })
      }
    }
    // Also scan assessment entries for documentTitle fields
    const scanAssessmentsForTitles = (arr) => {
      if (!Array.isArray(arr)) return
      arr.forEach(entry => {
        if (entry.document && entry.documentTitle && !docLabelMap[entry.document]) {
          docLabelMap[entry.document] = entry.documentTitle
        }
      })
    }
    if (window.abwa.criteriaManager && window.abwa.criteriaManager.currentCriterionGroups) {
      window.abwa.criteriaManager.currentCriterionGroups.forEach(cg => {
        scanAssessmentsForTitles(cg.config.options.assessments)
        scanAssessmentsForTitles(cg.config.options.compile)
      })
    }
    // Fallback: use the fingerprint itself
    const resolveLabel = (fp) => docLabelMap[fp] || fp

    let currentCriterionGroups = window.abwa.criteriaManager.currentCriterionGroups
    const criterionTag = Config.review.namespace + ':' + Config.review.tags.grouped.relation + ':'

    let r = new ReviewReport()

    for (let a in annotations) {
      let criterion = null
      let level = null
      let group = null
      for (let t in annotations[a].tags) {
        if (annotations[a].tags[t].indexOf(criterionTag) != -1) criterion = annotations[a].tags[t].replace(criterionTag, '').trim()
      }
      if(criterion!=null){
        let g = window.abwa.criteriaManager.currentCriterionGroups.find((el) => {return el.config.name === criterion})
        if (g!=null) group = g.config.options.group
      }
      let textQuoteSelector = null
      let highlightText = '';
      let pageNumber = null
      for (let k in annotations[a].target) {
        if (annotations[a].target[k].selector.find((e) => { return e.type === 'TextQuoteSelector' }) != null) {
          textQuoteSelector = annotations[a].target[k].selector.find((e) => { return e.type === 'TextQuoteSelector' })
          highlightText = textQuoteSelector.exact
        }
        if (annotations[a].target[k].selector.find((e) => { return e.type === 'FragmentSelector'}) != null){
          pageNumber = annotations[a].target[k].selector.find((e) => { return e.type === 'FragmentSelector'}).page
        }
      }
      let annotationText
      if (annotations[a].text!==null&&annotations[a].text!=='') {
        if (annotations[a].text) {
          annotationText = JSON.parse(annotations[a].text)
        } else {
          annotationText = { comment: '' }
        }
      } else {
        annotationText = { comment: '' }
      }
      let comment = annotationText.comment !== null ? annotationText.comment : null
      let clarifications = annotationText.clarifications !== null ? annotationText.clarifications : null
      let factChecking = annotationText.factChecking !== null ? annotationText.factChecking : null
      let socialJudge = annotationText.socialJudge !== null ? annotationText.socialJudge : null
      r.insertAnnotation(new Annotation(annotations[a].id,criterion,level,group,highlightText.replace(/(\r\n|\n|\r)/gm, ''),pageNumber,comment,clarifications,factChecking,socialJudge))
    }
    currentCriterionGroups.forEach((currentCriterionGroup) => {
      let criterion = currentCriterionGroup.config.name
      let group = currentCriterionGroup.config.options.group
      let description = currentCriterionGroup.config.options.description || ''
      let tagGroupAnnotations
      if (window.abwa.contentAnnotator) {
        let annotations = window.abwa.contentAnnotator.allAnnotations
        for (let i = 0; i < annotations.length; i++) {
          let model = window.abwa.criteriaManager.model
          let tag = model.namespace + ':' + model.config.grouped.relation + ':' + criterion
          tagGroupAnnotations = annotations.filter((annotation) => {
            return AnnotationUtils.hasATag(annotation, tag)
          })
        }
      }

      // Merge assessments from both new (assessments) and legacy (compile) arrays
      const premiseAssessments = currentCriterionGroup.config.options.assessments || []
      const premiseCompile = currentCriterionGroup.config.options.compile || []
      const cqAssessments = currentCriterionGroup.config.options.assessments || []
      const isQuestion = (group === 'Critical questions')
      const source = isQuestion ? cqAssessments : [...premiseAssessments, ...premiseCompile]

      if (!source || !Array.isArray(source) || source.length === 0) {
        // No assessments at all — still insert as unassessed criteria
        let data = { criterion, group, description }
        let assessedTag = new AssessedTag(data)
        r.insertCriteria(assessedTag)
        return
      }

      if (!filterByDoc) {
        // --- Multi-document: group assessments by document fingerprint ---
        // Collect unique documents from this criterion's assessments
        const docSet = new Set()
        source.forEach(entry => {
          if (entry.document) {
            const llmMatch = !filterByLLM || !currentLLM || !entry.llm || entry.llm === currentLLM
            if (llmMatch) docSet.add(entry.document)
          }
        })

        docSet.forEach(docId => {
          // Collect all matching assessments for this document
          const docAssessments = source.filter(entry => {
            const docMatch = entry.document === docId
            const llmMatch = !filterByLLM || !currentLLM || !entry.llm || entry.llm === currentLLM
            return docMatch && llmMatch
          })

          if (docAssessments.length === 0) return

          const docLabel = resolveLabel(docId)

          const first = docAssessments[0]
          let compile = ''
          let assessments = ''
          let allAssessments = null

          if (isQuestion) {
            assessments = first
            if (docAssessments.length > 1) allAssessments = docAssessments
          } else {
            compile = first
            if (docAssessments.length > 1) allAssessments = docAssessments
          }

          let data = { criterion, group, description }
          if (compile) data.compile = compile
          if (assessments) data.assessments = assessments
          if (allAssessments && allAssessments.length > 1) data.allAssessments = allAssessments

          let assessedTag = new AssessedTag(data)
          r.insertDocumentAssessment(docId, docLabel, assessedTag)
          r.insertCriteria(assessedTag)
          if (compile || assessments || (tagGroupAnnotations && tagGroupAnnotations.length > 0)) {
            r.insertAssessedCriteria(assessedTag)
          }
        })
      } else {
        // --- Single-document: original logic (current doc) ---
        let compile = ''
        let allAssessments = null
        let assessments = ''

        const matching = source.filter(entry => {
          const docMatch = !filterByDoc || entry.document === currentDoc
          const llmMatch = !filterByLLM || !currentLLM || !entry.llm || entry.llm === currentLLM
          return docMatch && llmMatch
        })

        if (matching.length > 0) {
          if (isQuestion) {
            assessments = matching[0]
            if (matching.length > 1) allAssessments = matching
          } else {
            compile = matching[0]
            if (matching.length > 1) allAssessments = matching
          }
        }

        // Backward compat: old format
        if (!assessments) {
          let alternative = ''
          if (currentCriterionGroup.config.options.alternative && currentCriterionGroup.config.options.alternative.length > 0) {
            const findAlternative = currentCriterionGroup.config.options.alternative.find((alt) => {
              const docMatch = !filterByDoc || alt.document === currentDoc
              const llmMatch = !filterByLLM || !currentLLM || !alt.llm || alt.llm === currentLLM
              return docMatch && llmMatch
            })
            if (findAlternative) alternative = findAlternative
          }
          let fullQuestion = ''
          if (currentCriterionGroup.config.options.fullQuestion && currentCriterionGroup.config.options.fullQuestion.length > 0) {
            const findFullQuestion = currentCriterionGroup.config.options.fullQuestion.find((question) => {
              const docMatch = !filterByDoc || question.document === currentDoc
              const llmMatch = !filterByLLM || !currentLLM || !question.llm || question.llm === currentLLM
              return docMatch && llmMatch
            })
            if (findFullQuestion) fullQuestion = findFullQuestion
          }
          if (alternative || fullQuestion) {
            assessments = {
              document: (alternative && alternative.document) || (fullQuestion && fullQuestion.document),
              adaptedQuestion: fullQuestion ? fullQuestion.fullQuestion : '',
              answer: alternative ? alternative.answer : '',
              excerpt: alternative ? alternative.excerpt : '',
              argument: alternative ? alternative.argument : '',
              counterargument: alternative ? alternative.counterargument : '',
              llm: alternative ? alternative.llm : ''
            }
          }
        }

        let data = { criterion, group, description }
        if (compile) data.compile = compile
        if (assessments) data.assessments = assessments
        if (allAssessments && allAssessments.length > 1) data.allAssessments = allAssessments

        let assessedTag = new AssessedTag(data)
        r.insertCriteria(assessedTag)
        if (compile || assessments || (tagGroupAnnotations && tagGroupAnnotations.length > 0)) {
          r.insertAssessedCriteria(assessedTag)
        }
      }
    })
    return r
  }

  generateSpreadsheetButtonHandler () {
    $.contextMenu({
      selector: '#csvExportButton',
      trigger: 'left',
      build: () => {
        let items = {}
        items['csv'] = { name: 'Export as CSV' }
        items['excel'] = { name: 'Export as Excel' }
        return {
          callback: (key) => {
            if (key === 'csv') {
              this.generateExcel(Config.exportScope.ALL_DOCS_ALL_LLM)
            } else if (key === 'excel') {
              this.generateXLSX(Config.exportScope.ALL_DOCS_ALL_LLM)
            }
          },
          items: items
        }
      }
    })
  }

  newSchemaButtonHandler () {
    Alerts.createGroupAlert({
      callbackCreateEmpty: () => {
        window.abwa.groupSelector.importEmptyConfiguration()
      },
      callbackImportJSON: () => {
        window.abwa.groupSelector.importCriteriaConfiguration()
      },
      callbackImportStandard: () => {
        window.abwa.groupSelector.importStandardModelConfiguration()
      }
    })
  }

  generateExcel (scope = Config.exportScope.CURRENT_DOC_CURRENT_LLM) {
    const filterByDoc = (scope === Config.exportScope.CURRENT_DOC_CURRENT_LLM || scope === Config.exportScope.CURRENT_DOC_ALL_LLM)
    const filterByLLM = (scope === Config.exportScope.CURRENT_DOC_CURRENT_LLM || scope === Config.exportScope.ALL_DOCS_CURRENT_LLM)
    const currentDoc = window.abwa.contentTypeManager.pdfFingerprint
    const currentLLM = window.abwa && window.abwa.currentLLMModel

    // Collect criteria definitions (name, group) from currentCriterionGroups
    const criteriaDefs = (window.abwa.criteriaManager.currentCriterionGroups || []).map(cg => ({
      name: cg.config.name,
      group: cg.config.options.group
    }))

    // Build map: criteriaName → { document → { model → assessment } }
    // and collect all (document, model) pairs
    const pairs = new Map() // key: "doc|model", value: { document, model, documentTitle }
    const dataMap = {} // criteriaName → Map("doc|model" → assessment)

    criteriaDefs.forEach(def => {
      dataMap[def.name] = new Map()
    })

    criteriaDefs.forEach(def => {
      const cg = window.abwa.criteriaManager.currentCriterionGroups.find(c => c.config.name === def.name)
      if (!cg) return
      const source = cg.config.options.assessments || cg.config.options.compile
      if (!Array.isArray(source)) return

      source.forEach(entry => {
        const doc = entry.document
        if (!doc) return
        if (filterByDoc && doc !== currentDoc) return

        const entryModel = entry.llm || (entry.answer && entry.answer.llm) || ''
        if (filterByLLM && currentLLM && entryModel && entryModel !== currentLLM) return

        const pairKey = doc + '|' + entryModel
        if (!pairs.has(pairKey)) {
          pairs.set(pairKey, {
            document: doc,
            model: entryModel,
            documentTitle: entry.documentTitle || doc
          })
        }
        dataMap[def.name].set(pairKey, entry)
      })
    })

    // Build document labels (same logic as HTML export)
    const docLabelMap = {}
    if (window.abwa.storageManager && window.abwa.storageManager.annotationsDatabase) {
      const db = window.abwa.storageManager.annotationsDatabase
      if (db.annotations) {
        db.annotations.forEach(ann => {
          const fp = ann.document && ann.document.documentFingerprint
          if (!fp || docLabelMap[fp]) return
          if (ann.document.title && ann.document.title.length > 0) {
            docLabelMap[fp] = ann.document.title; return
          }
          const lf = (ann.document.link || []).find(l => l.type === 'localfile')
          if (lf) {
            try { docLabelMap[fp] = decodeURIComponent(new URL(lf.href).pathname.split('/').pop()); return } catch (e) {}
          }
        })
      }
    }
    criteriaDefs.forEach(def => {
      const cg = window.abwa.criteriaManager.currentCriterionGroups.find(c => c.config.name === def.name)
      if (!cg) return
      const source = cg.config.options.assessments || cg.config.options.compile
      if (!Array.isArray(source)) return
      source.forEach(entry => {
        if (entry.document && entry.documentTitle && !docLabelMap[entry.document]) {
          docLabelMap[entry.document] = entry.documentTitle
        }
      })
    })
    const resolveLabel = (fp) => docLabelMap[fp] || fp

    // Separate premises (including Conclusion) and CQs, preserving order
    const premiseNames = criteriaDefs.filter(d => d.group === 'Premises').map(d => d.name)
    const cqNames = criteriaDefs.filter(d => d.group === 'Critical questions').map(d => d.name)

    // Build CSV rows
    const columns = ['DOCUMENT', 'MODEL', ...premiseNames, ...cqNames]
    const rows = [columns]

    pairs.forEach((pair, pairKey) => {
      const row = [resolveLabel(pair.document), pair.model]
      premiseNames.forEach(name => {
        const entry = dataMap[name] && dataMap[name].get(pairKey)
        if (!entry) { row.push(''); return }
        const answer = entry.answer
        const text = typeof answer === 'string' ? answer : (answer && answer.statement) || ''
        const sentiment = (answer && answer.sentiment) || entry.sentiment || ''
        const prefix = sentiment === 'green' ? '🟢 ' : sentiment === 'yellow' ? '🟡 ' : sentiment === 'red' ? '🔴 ' : ''
        row.push(prefix + text)
      })
      cqNames.forEach(name => {
        const entry = dataMap[name] && dataMap[name].get(pairKey)
        if (!entry) { row.push(''); return }
        const answer = entry.answer || ''
        const text = typeof answer === 'string' ? answer : (answer.answer || answer.statement || answer)
        row.push(text)
      })
      rows.push(row)
    })

    // Convert to CSV
    const escapeCell = (val) => {
      const s = String(val || '')
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"'
      }
      return s
    }
    const csv = rows.map(r => r.map(escapeCell).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const schemaName = (window.abwa.groupSelector.currentGroup && window.abwa.groupSelector.currentGroup.name) || 'analysis'
    link.download = schemaName + '-report.csv'
    link.click()
  }

  generateXLSX (scope = Config.exportScope.CURRENT_DOC_CURRENT_LLM) {
    const XLSX = require('xlsx')
    const filterByDoc = (scope === Config.exportScope.CURRENT_DOC_CURRENT_LLM || scope === Config.exportScope.CURRENT_DOC_ALL_LLM)
    const filterByLLM = (scope === Config.exportScope.CURRENT_DOC_CURRENT_LLM || scope === Config.exportScope.ALL_DOCS_CURRENT_LLM)
    const currentDoc = window.abwa.contentTypeManager.pdfFingerprint
    const currentLLM = window.abwa && window.abwa.currentLLMModel

    const criteriaDefs = (window.abwa.criteriaManager.currentCriterionGroups || []).map(cg => ({
      name: cg.config.name,
      group: cg.config.options.group
    }))

    const pairs = new Map()
    const dataMap = {}
    criteriaDefs.forEach(def => { dataMap[def.name] = new Map() })

    criteriaDefs.forEach(def => {
      const cg = window.abwa.criteriaManager.currentCriterionGroups.find(c => c.config.name === def.name)
      if (!cg) return
      const source = cg.config.options.assessments || cg.config.options.compile
      if (!Array.isArray(source)) return
      source.forEach(entry => {
        const doc = entry.document
        if (!doc) return
        if (filterByDoc && doc !== currentDoc) return
        const entryModel = entry.llm || (entry.answer && entry.answer.llm) || ''
        if (filterByLLM && currentLLM && entryModel && entryModel !== currentLLM) return
        const pairKey = doc + '|' + entryModel
        if (!pairs.has(pairKey)) {
          pairs.set(pairKey, { document: doc, model: entryModel, documentTitle: entry.documentTitle || doc })
        }
        dataMap[def.name].set(pairKey, entry)
      })
    })

    // Document labels
    const docLabelMap = {}
    if (window.abwa.storageManager && window.abwa.storageManager.annotationsDatabase) {
      const db = window.abwa.storageManager.annotationsDatabase
      if (db.annotations) {
        db.annotations.forEach(ann => {
          const fp = ann.document && ann.document.documentFingerprint
          if (!fp || docLabelMap[fp]) return
          if (ann.document.title && ann.document.title.length > 0) { docLabelMap[fp] = ann.document.title; return }
          const lf = (ann.document.link || []).find(l => l.type === 'localfile')
          if (lf) {
            try { docLabelMap[fp] = decodeURIComponent(new URL(lf.href).pathname.split('/').pop()); return } catch (e) {}
          }
        })
      }
    }
    criteriaDefs.forEach(def => {
      const cg = window.abwa.criteriaManager.currentCriterionGroups.find(c => c.config.name === def.name)
      if (!cg) return
      const source = cg.config.options.assessments || cg.config.options.compile
      if (!Array.isArray(source)) return
      source.forEach(entry => {
        if (entry.document && entry.documentTitle && !docLabelMap[entry.document]) {
          docLabelMap[entry.document] = entry.documentTitle
        }
      })
    })
    const resolveLabel = (fp) => docLabelMap[fp] || fp

    const premiseNames = criteriaDefs.filter(d => d.group === 'Premises').map(d => d.name)
    const cqNames = criteriaDefs.filter(d => d.group === 'Critical questions').map(d => d.name)
    const columns = ['Model', ...premiseNames, ...cqNames]

    // Group pairs by document
    const docGroups = new Map() // fp → [pair, ...]
    pairs.forEach((pair) => {
      if (!docGroups.has(pair.document)) docGroups.set(pair.document, [])
      docGroups.get(pair.document).push(pair)
    })

    // Create workbook with one sheet per document
    const wb = XLSX.utils.book_new()
    docGroups.forEach((docPairs, docFp) => {
      const rows = [columns]
      docPairs.forEach(pair => {
        const pairKey = pair.document + '|' + pair.model
        const row = [pair.model]
        premiseNames.forEach(name => {
          const entry = dataMap[name] && dataMap[name].get(pairKey)
          if (!entry) { row.push(''); return }
          const answer = entry.answer
          const text = typeof answer === 'string' ? answer : (answer && answer.statement) || ''
          const sentiment = (answer && answer.sentiment) || entry.sentiment || ''
          const prefix = sentiment === 'green' ? '🟢 ' : sentiment === 'yellow' ? '🟡 ' : sentiment === 'red' ? '🔴 ' : ''
          row.push(prefix + text)
        })
        cqNames.forEach(name => {
          const entry = dataMap[name] && dataMap[name].get(pairKey)
          if (!entry) { row.push(''); return }
          const answer = entry.answer || ''
          const text = typeof answer === 'string' ? answer : (answer.answer || answer.statement || answer)
          row.push(text)
        })
        rows.push(row)
      })
      const ws = XLSX.utils.aoa_to_sheet(rows)
      // Set column widths
      ws['!cols'] = columns.map((c, i) => {
        if (i === 0) return { wch: 20 }
        const maxLen = Math.max(c.length, ...rows.slice(1).map(r => String(r[i] || '').length))
        return { wch: Math.min(Math.max(maxLen, 10), 50) }
      })
      const sheetName = resolveLabel(docFp).replace(/[\[\]\*\?\/\\:]/g, '').substring(0, 31) || 'Document'
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    })

    // Write and download
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const schemaName = (window.abwa.groupSelector.currentGroup && window.abwa.groupSelector.currentGroup.name) || 'analysis'
    FileSaver.saveAs(blob, schemaName + '-report.xlsx')
  }

  configurationButtonHandler () {
    // Create context menu
    $.contextMenu({
      selector: '#configurationButton',
      trigger: 'left',
      build: () => {
        // Create items for context menu
        let items = {}
        items['manual'] = {name: 'User manual'}
        items['config'] = {name: 'Configuration'}
        // items['prompts'] = {name: 'Prompts'}
        return {
          callback: (key, opt) => {
            if (key === 'manual') {
              window.open("https://github.com/onekin/DeceptionAnalyser","_blank")
            } else if (key === 'config') {
              window.open(chrome.runtime.getURL('/pages/options.html'),"_blank")
            }
          },
          items: items
        }
      }
    })
  }

  generateReviewByCategory (scope = Config.exportScope.CURRENT_DOC_CURRENT_LLM) {
    Alerts.loadingAlert({text: chrome.i18n.getMessage('GeneratingReviewReport')})
    let review = this.parseAnnotations(window.abwa.contentAnnotator.allAnnotations, scope)
    let report = review.groupByCategoryHTML(scope)
    let blob = new Blob([report], {type: 'text/html;charset=utf-8'});
    const schemaName = (window.abwa.groupSelector.currentGroup && window.abwa.groupSelector.currentGroup.name) || 'analysis'
    FileSaver.saveAs(blob, schemaName + '-report.html')
    Alerts.closeAlert()
  }

  generatePDF () {
    // TODO Implement PDF generation
  }

  deleteAnnotations () {
    // Ask user if they are sure to delete it
    Alerts.confirmAlert({
      alertType: Alerts.alertType.question,
      title: chrome.i18n.getMessage('DeleteAllAnnotationsConfirmationTitle'),
      text: chrome.i18n.getMessage('DeleteAllAnnotationsConfirmationMessage'),
      callback: (err, toDelete) => {
        // It is run only when the user confirms the dialog, so delete all the annotations
        if (err) {
          // Nothing to do
        } else {
          // Dispatch delete all annotations event
          LanguageUtils.dispatchCustomEvent(Events.deleteAllAnnotations)
          // TODO Check if it is better to maintain the sidebar opened or not
          window.abwa.sidebar.openSidebar()
        }
      }
    })

  }

  resume (){
    if(window.abwa.contentAnnotator.allAnnotations.length>0) window.abwa.contentAnnotator.goToAnnotation(window.abwa.contentAnnotator.allAnnotations.reduce((max,a) => new Date(a.updated) > new Date(max.updated) ? a : max))
  }

  destroy (callback) {
    // Remove toolbar
    this.container.remove()

    // Callback
    if (_.isFunction(callback)) {
      callback()
    }
  }

  static tryToLoadSwal () {
    if (_.isNull(Swal)) {
      try {
        Swal = require('sweetalert2')
      } catch (e) {
        Swal = null
      }
    }
  }
}

export default ReviewGenerator
