/* eslint-disable */

import Config from '../../Config'
import Alerts from '../../utils/Alerts'
import AnnotationUtils from '../../utils/AnnotationUtils'
import LocalStorageManager from '../../storage/local/LocalStorageManager'
import jsYaml from 'js-yaml'


const axios = require('axios')
const _ = require('lodash')
const LanguageUtils = require('../../utils/LanguageUtils')
const $ = require('jquery')
require('jquery-contextmenu/dist/jquery.contextMenu')
const {Review, AssessedTag, Annotation} = require('../../exporter/reviewModel.js')
const FileSaver = require('file-saver')
const Events = require('../../contentScript/Events')

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
      // Set generator image and event
      let categoryGeneratorImageURL = chrome.runtime.getURL('/images/generator.png')
      this.categoryBasedImage = this.container.querySelector('#categoryReviewGeneratorButton')
      this.categoryBasedImage.src = categoryGeneratorImageURL
      this.categoryBasedImage.addEventListener('click', () => {
        this.generateCategoryReviewButtonHandler()
      })
      // Set delete annotations image and event
      let deleteAnnotationsImageURL = chrome.runtime.getURL('/images/deleteAnnotations.png')
      this.deleteAnnotationsImage = this.container.querySelector('#deleteAnnotationsButton')
      this.deleteAnnotationsImage.src = deleteAnnotationsImageURL
      this.deleteAnnotationsImage.addEventListener('click', () => {
        this.deleteAnnotations()
      })
      // Set configuration button
      let configurationImageURL = chrome.runtime.getURL('/images/configuration.png')
      this.configurationImage = this.container.querySelector('#configurationButton')
      this.configurationImage.src = configurationImageURL
      this.configurationImage.addEventListener('click', () => {
        this.configurationButtonHandler()
      })
      if (_.isFunction(callback)) {
        callback()
      }
      // New schema button
      // let newSchemaImageURL = chrome.runtime.getURL('/images/add.png')
      this.newSchemaImage = this.container.querySelector('#newSchemaButton')
      // this.newSchemaImage.src = newSchemaImageURL
      this.newSchemaImage.addEventListener('click', () => {
        this.newSchemaButtonHandler()
      })
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }
  parseAnnotations (annotations){
    let currentTags = window.abwa.tagManager.currentTags
    const criterionTag = Config.review.namespace + ':' + Config.review.tags.grouped.relation + ':'

    let r = new Review()

    for (let a in annotations) {
      let criterion = null
      let level = null
      let group = null
      for (let t in annotations[a].tags) {
        if (annotations[a].tags[t].indexOf(criterionTag) != -1) criterion = annotations[a].tags[t].replace(criterionTag, '').trim()
      }
      if(criterion!=null){
        let g = window.abwa.tagManager.currentTags.find((el) => {return el.config.name === criterion})
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
    currentTags.forEach((currentTagGroup) => {
      let criterion = currentTagGroup.config.name
      let tagGroupAnnotations
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
      let compile = ''
      if (currentTagGroup.config.options.compile && currentTagGroup.config.options.compile.length > 0) {
        const findResume = currentTagGroup.config.options.compile.find((resume) => {
          return resume.document === window.abwa.contentTypeManager.pdfFingerprint
        })
        if (findResume) {
          compile = findResume
        }
      }
      let alternative = ''
      if (currentTagGroup.config.options.alternative && currentTagGroup.config.options.alternative.length > 0) {
        const findAlternative = currentTagGroup.config.options.alternative.find((alternative) => {
          return alternative.document === window.abwa.contentTypeManager.pdfFingerprint
        })
        if (findAlternative) {
          if (Array.isArray(findAlternative.answer)) {
            alternative = findAlternative.answer.join('')
          }
          else  {
            alternative = findAlternative.answer
          }
        }
      }
      let fullQuestion = ''
      if (currentTagGroup.config.options.fullQuestion && currentTagGroup.config.options.fullQuestion.length > 0) {
        const findFullQuestion = currentTagGroup.config.options.fullQuestion.find((question) => {
          return question.document === window.abwa.contentTypeManager.pdfFingerprint
        })
        if (findFullQuestion) {
          fullQuestion = findFullQuestion
        }
      }
      let description = ''
      if (currentTagGroup.config.options.description) {
        description = currentTagGroup.config.options.description
      }
      let data = {}
      data.criterion = currentTagGroup.config.name
      data.group = currentTagGroup.config.options.group
      if (compile) {
        data.compile = compile
      }
      if (alternative) {
        data.alternative = alternative
      }
      if (fullQuestion) {
        data.fullQuestion = fullQuestion
      }
      if (description) {
        data.description = description
      }
      let assessedTag = new AssessedTag(data)
      r.insertCriteria(assessedTag)
      if (compile || alternative || (tagGroupAnnotations && tagGroupAnnotations.length > 0)) {
        r.insertAssessedCriteria(assessedTag)
      }
    })
    return r
  }

  generateCategoryReviewButtonHandler () {
    // Create context menu
    $.contextMenu({
      selector: '#categoryReviewGeneratorButton',
      trigger: 'left',
      build: () => {
        // Create items for context menu
        let items = {}
        items['html'] = {name: 'Export as HTML'}
        items['excel'] = {name: 'Export as .csv'}
        return {
          callback: (key, opt) => {
            if (key === 'html') {
              this.generateReviewByCategory()
            } else if (key === 'excel') {
              this.generateExcel()
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

  generateExcel () {
    let db = window.abwa.storageManager.annotationsDatabase
    let annotations = this.getReviewCriteriaAnnotations(db, window.abwa.groupSelector.currentGroup.id)
    console.log(annotations)

    // STEP 1: Build document ID → local file URL mapping
    let documentIdToLocalFileMap = {}
    db.annotations.forEach(annotation => {
      if (annotation.document && Array.isArray(annotation.document.link)) {
        const docId = annotation.document.documentFingerprint
        const localFile = annotation.document.link.find(link => link.type === "localfile")
        if (docId && localFile) {
          documentIdToLocalFileMap[docId] = localFile.href
        }
      }
    })

    let result = []
    annotations.forEach(annotation => {
      const criteriaTag = annotation.tags.find(tag => tag.startsWith("review:criteria:"))
      const criteria = criteriaTag ? criteriaTag.replace("review:criteria:", "") : null

      // Parse the text (YAML-like)
      let parsed;
      try {
        parsed = jsYaml.load(annotation.text)
      } catch (e) {
        console.warn("Failed to parse annotation text as YAML", annotation.text)
        return
      }

      const description = parsed.description || ''

      if (Array.isArray(parsed.compile)) {
        parsed.compile.forEach(entry => {
          result.push({
            criteria,
            description,
            document: entry.document,
            answer: entry.answer
          })
        })
      }
    })

    console.log(result)
    const grouped = this.groupByCriteria(result) // assuming your array is called `data`

    console.log(grouped)
    const csv = this.generateCriteriaMatrixCSV(grouped, documentIdToLocalFileMap) // `grouped` is your input object
    console.log(csv)

    // Optional: download as a .csv file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    let name = window.abwa.groupSelector.currentGroup.name + '.csv'
    link.download = name
    link.click();
  }

  groupByCriteria(entries) {
    return entries.reduce((groups, entry) => {
      const key = entry.criteria

      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(entry)
      return groups
    }, {})
  }

  generateCriteriaMatrixCSV (groupedData, documentIdToLocalFileMap) {
    const documentsSet = new Set()
    const criteriaList = Object.keys(groupedData)

    // Step 1: Collect all unique documents
    for (const criteria of criteriaList) {
      for (const entry of groupedData[criteria]) {
        documentsSet.add(entry.document)
      }
    }

    const documents = Array.from(documentsSet)

    // Step 2: Create header with criteria and their descriptions
    const header = ['DOCUMENT']
    for (const criteria of criteriaList) {
      const firstEntry = groupedData[criteria][0]
      const description = firstEntry.description || ''
      const label = `${criteria}: ${description.replace(/"/g, '""')}`
      header.push(`"${label}"`);
    }

    // Step 3: Build rows
    const rows = [header]

    for (const doc of documents) {
      const fileUrl = documentIdToLocalFileMap[doc] || 'N/A'

      // Extract just the filename from the file URL
      let filename = 'N/A'
      if (fileUrl !== 'N/A') {
        try {
          filename = decodeURIComponent(new URL(fileUrl).pathname.split("/").pop())
        } catch (e) {
          console.warn("Failed to parse file URL:", fileUrl)
        }
      }

      const row = [filename]  // Use filename here instead of full path
      for (const criteria of criteriaList) {
        const entry = groupedData[criteria].find(e => e.document === doc)
        if (!entry) {
          row.push('')
        } else {
          const answer = typeof entry.answer === 'string'
            ? entry.answer
            : entry.answer.statement || ''
          row.push(`"${answer.replace(/"/g, '""')}"`)
        }
      }
      rows.push(row)
    }

    // Step 4: Convert to CSV
    const csv = rows.map(row => row.join(',')).join('\n')
    return csv
  }

  getReviewCriteriaAnnotations(data, groupId) {
    return data.annotations.filter(annotation => {
      return (
        annotation.group === groupId &&
        annotation.tags &&
        annotation.tags.some(tag => tag.startsWith("review:criteria:"))
      );
    })
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
            } /* else if (key === 'prompts') {
              window.open(chrome.runtime.getURL('/pages/promptConfiguration.html'), "_blank")
            } */
          },
          items: items
        }
      }
    })
  }

  generateReviewByCategory () {
    Alerts.loadingAlert({text: chrome.i18n.getMessage('GeneratingReviewReport')})
    let review = this.parseAnnotations(window.abwa.contentAnnotator.allAnnotations)
    let report = review.groupByCategoryHTML()
    // let blob = new Blob([report], {type: 'text/plain;charset=utf-8'})
    let blob = new Blob([report], {type: 'text/html;charset=utf-8'});
    let title = window.PDFViewerApplication.baseUrl !== null ? window.PDFViewerApplication.baseUrl.split("/")[window.PDFViewerApplication.baseUrl.split("/").length-1].replace(/\.pdf/i,"") : ""
    let docTitle = 'Review report'
    if(title!=='') docTitle += ' for '+title
    FileSaver.saveAs(blob, docTitle+'.html')
    Alerts.closeAlert()
  }

  generatePDF () {
    // 1️⃣ Create a very simple test div
    const container = document.createElement('div');
    container.innerHTML = `
    <h1 style="color: navy;">Hello PDF!</h1>
    <p>This is a test to check html2pdf integration.</p>
    <ul>
      <li>Point one</li>
      <li>Point two</li>
    </ul>
  `;

    // 2️⃣ Make sure it's visible for rendering
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.left = '20px';
    container.style.width = '600px';
    container.style.padding = '20px';
    container.style.background = 'white';
    container.style.border = '1px solid black';
    document.body.appendChild(container);

    // 3️⃣ Wait a moment for render
    setTimeout(() => {
      html2pdf()
        .set({
          margin: 10,
          filename: 'TestReport.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(container)
        .save()
        .then(() => {
          console.log('✅ PDF generated successfully!');
          document.body.removeChild(container);
        })
        .catch(err => {
          console.error('❌ Error generating PDF', err);
          document.body.removeChild(container);
        });
    }, 300);
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
