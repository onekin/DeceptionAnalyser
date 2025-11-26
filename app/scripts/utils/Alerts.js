import _ from 'lodash'
import LanguageUtils from './LanguageUtils'
import Events from '../contentScript/Events'
import CustomCriteriasManager from '../specific/review/CustomCriteriasManager'
import jsYaml from 'js-yaml'

let swal = null
if (document && document.head) {
  swal = require('sweetalert2')
}

class Alerts {
  static confirmAlert ({alertType = Alerts.alertType.info, title = '', text = '', cancelButtonText = 'Cancel', confirmButtonText = 'OK', showCancelButton = true, callback, cancelCallback}) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      swal.fire({
        title: title,
        html: text,
        icon: alertType,
        showCancelButton: showCancelButton,
        cancelButtonText: cancelButtonText,
        confirmButtonText: confirmButtonText
      }).then((result) => {
        if (result.value) {
          if (_.isFunction(callback)) {
            callback(null, result.value)
          }
        } else {
          if (_.isFunction(callback)) {
            // callback(null, result.value)
          }
        }
      })
    }
  }

  static infoAlert ({text = chrome.i18n.getMessage('expectedInfoMessageNotFound'), title = 'Info', callback, confirmButtonText = 'OK'}) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      swal.fire({
        type: Alerts.alertType.info,
        title: title,
        confirmButtonText: confirmButtonText,
        html: text
      }).then(() => {
        if (_.isFunction(callback)) {
          callback(null)
        }
      })
    }
  }

  static createGroupAlert ({ text = chrome.i18n.getMessage('expectedInfoMessageNotFound'), title = 'How do you want to create the schema?', callbackCreateEmpty, callbackImportJSON, callbackImportStandard }) {
    Alerts.tryToLoadSwal()

    if (_.isNull(swal)) {
      if (_.isFunction(callbackCreateEmpty)) {
        callbackCreateEmpty(new Error('Unable to load swal'))
      }
    } else {
      swal.fire({
        icon: Alerts.alertType.info,
        title: title,
        showConfirmButton: false,
        html: `
        <div style="display: flex; flex-direction: column; gap: 10px;">
        <button id="btn-import-standard" class="swal2-confirm swal2-styled">Import Standard Schema</button>
        <button id="btn-import-json" class="swal2-confirm swal2-styled">Import Schema from JSON</button>
        <button id="btn-empty-schema" class="swal2-confirm swal2-styled">Create Empty Schema</button> 
        </div>
        <!--<div style="margin-top: 15px; font-size: 0.9em; color: #666;">${text}</div>->
      `,
        didOpen: () => {
          const btnEmpty = document.getElementById('btn-empty-schema')
          const btnJSON = document.getElementById('btn-import-json')
          const btnStandard = document.getElementById('btn-import-standard')

          if (btnEmpty) {
            btnEmpty.addEventListener('click', () => {
              if (_.isFunction(callbackCreateEmpty)) callbackCreateEmpty()
            })
          }

          if (btnJSON) {
            btnJSON.addEventListener('click', () => {
              if (_.isFunction(callbackImportJSON)) callbackImportJSON()
            })
          }

          if (btnStandard) {
            btnStandard.addEventListener('click', () => {
              if (_.isFunction(callbackImportStandard)) callbackImportStandard()
            })
          }
        }
      })
    }
  }

  static criterionInfoAlert ({text = chrome.i18n.getMessage('expectedInfoMessageNotFound'), title = 'Info', callback, confirmButtonText = 'OK', width, showCancelButton = false, cancelButtonText = 'Cancel', cancelButtonColor = '#757575', cancelCallback = null, currentTagGroup = null}) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      swal.fire({
        type: Alerts.alertType.info,
        title: title,
        confirmButtonText: confirmButtonText,
        html: text,
        showCancelButton: showCancelButton,
        cancelButtonText: cancelButtonText,
        cancelButtonColor: cancelButtonColor,
        onBeforeOpen: () => {
          let element = document.querySelector('.swal2-popup')
          element.style.width = '900px'
        },
        didOpen: () => {
          // Attach listeners here after modal content is in DOM
          const container = document.querySelector('#sentiment-container')
          if (!container) return
          container.querySelectorAll('img[data-sentiment]').forEach(img => {
            img.addEventListener('click', () => {
              const selected = img.getAttribute('data-sentiment')
              // Store your sentiment value however you want
              CustomCriteriasManager.attachSentimentListeners(currentTagGroup, selected)
              // Optionally close modal or re-render it
            })
          })
        }
      }).then((result) => {
        /* Read more about isConfirmed, isDenied below */
        if (result.isConfirmed) {
          if (_.isFunction(callback)) {
            callback(null)
          }
        } else {
          if (_.isFunction(cancelCallback)) {
            cancelCallback(null)
          }
        }
      })
    }
  }

  static feedbackAlert ({ title = 'Input', html = '', preConfirm, preDeny, position = 'center', onBeforeOpen, showDenyButton = true, showCancelButton = true, confirmButtonText = 'Confirm', confirmButtonColor = '#4BB543', denyButtonText = 'Deny', denyButtonColor = '#3085D6', cancelButtonText = 'Cancel', allowOutsideClick = true, allowEscapeKey = true, callback, denyCallback, cancelCallback, customClass, willOpen }) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      swal.fire({
        title: title,
        html: html,
        focusConfirm: false,
        preConfirm: preConfirm,
        preDeny: preDeny,
        position: position,
        allowOutsideClick,
        allowEscapeKey,
        customClass: customClass,
        showDenyButton: showDenyButton,
        showCancelButton: showCancelButton,
        confirmButtonText: confirmButtonText,
        confirmButtonColor: confirmButtonColor,
        denyButtonText: denyButtonText,
        denyButtonColor: denyButtonColor,
        cancelButtonText: cancelButtonText,
        willOpen: willOpen
      }).then((result) => {
        /* Read more about isConfirmed, isDenied below */
        if (result.isConfirmed) {
          if (_.isFunction(callback)) {
            callback(null, result.value)
          }
        } else if (result.isDenied) {
          if (_.isFunction(callback)) {
            denyCallback(null, result.value)
          }
        } else {
          if (_.isFunction(cancelCallback)) {
            cancelCallback(null)
          }
        }
      })
    }
  }

  static errorAlert ({text = chrome.i18n.getMessage('unexpectedError'), title = 'Oops...', callback, onClose}) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      swal.fire({
        type: Alerts.alertType.error,
        title: title,
        html: text,
        onClose: onClose
      }).then(() => {
        if (_.isFunction(callback)) {
          callback(null)
        }
      })
    }
  }

  static successAlert ({text = 'Your process is correctly done', title = 'Great!', callback}) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      swal.fire({
        icon: 'success',
        title: title,
        html: text
      })
    }
  }

  static loadingAlert ({text = 'If it takes too much time, please reload the page and try again.', position = 'top-end', title = 'Working on something, please be patient', confirmButton = false, timerIntervalHandler, callback}) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      let timerInterval
      swal.fire({
        position: position,
        title: title,
        html: text,
        showConfirmButton: confirmButton,
        onBeforeOpen: () => {
          swal.showLoading()
          if (_.isFunction(timerIntervalHandler)) {
            timerInterval = setInterval(() => {
              if (swal.isVisible()) {
                timerIntervalHandler(swal)
              } else {
                clearInterval(timerInterval)
              }
            }, 100)
          }
        }
      })
    }
  }

  static inputTextAlert ({title, input = 'text', type, inputPlaceholder = '', inputValue = '', preConfirm, cancelCallback, showCancelButton = true, html = '', callback}) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      swal.fire({
        title: title,
        input: input,
        inputPlaceholder: inputPlaceholder,
        inputValue: inputValue,
        html: html,
        type: type,
        preConfirm: preConfirm,
        showCancelButton: showCancelButton
      }).then((result) => {
        if (result.value) {
          if (_.isFunction(callback)) {
            callback(null, result.value)
          }
        } else {
          if (_.isFunction(cancelCallback)) {
            cancelCallback()
          }
        }
      })
    }
  }

  static answerCriterionAlert ({ title = 'This is the answer:', answer = '', paragraphs = '', description = '', annotation = '', type, criterion = '', compileSentiment = '' }) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {

    } else {
      const buttons = '<button id="llmAnswerOKButton" >Ok</button></br><button id="redoButton" class="llmAnswerButton">Redo</brbutton><button id="summaryButton" class="llmAnswerButton">Save answer</button>'
      let html
      if (criterion) {
        html = '<b>' + criterion + ':</b><br>' + '<div style="text-align: justify;text-justify: inter-word" width=550px>' + answer + '</div></br>' + buttons
      } else {
        html = '<div style="text-align: justify;text-justify: inter-word" width=550px>' + answer + '</div></br>' + buttons
      }
      swal.fire({
        title: title,
        html: html,
        showCancelButton: false,
        showConfirmButton: false,
        onBeforeOpen: () => {
          let element = document.querySelector('.swal2-popup')
          element.style.width = '600px'
          // Add event listeners to the buttons after they are rendered
          document.getElementById('llmAnswerOKButton').addEventListener('click', () => {
            swal.close()
          })
          document.getElementById('redoButton').addEventListener('click', () => {
            swal.close()
            if (type === 'compile') {
              CustomCriteriasManager.compile(criterion, description, paragraphs)
            } else if (type === 'alternative') {
              CustomCriteriasManager.alternative(criterion, description)
            }
          })
          document.getElementById('summaryButton').addEventListener('click', () => {
            let data
            if (annotation.text) {
              data = jsYaml.load(annotation.text)
              if (type === 'compile') {
                // Check if data.resume exists and is an array. If not, initialize it as an empty array.
                if (!Array.isArray(data.compile)) {
                  data.compile = []
                }
                // Now that we're sure data.resume is an array, push the new object into it.
                data.compile.push({ document: window.abwa.contentTypeManager.pdfFingerprint, answer: answer })
              } else if (type === 'alternative') {
                // Check if data.alternative exists and is an array. If not, initialize it as an empty array.
                if (!Array.isArray(data.alternative)) {
                  data.alternative = []
                }
                // Now that we're sure data.alternative is an array, push the new object into it.
                data.alternative.push({ document: window.abwa.contentTypeManager.pdfFingerprint, answer: answer })
              }
            }
            annotation.text = jsYaml.dump(data)
            LanguageUtils.dispatchCustomEvent(Events.updateTagAnnotation, {annotation: annotation})
            swal.close()
            Alerts.successAlert({title: 'Saved', text: 'The text has been saved in the report'})
          })
        }
      })
    }
  }

  static multipleInputAlert ({title = 'Input', html = '', preConfirm, showCancelButton = true, callback}) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      swal.fire({
        title: title,
        html: html,
        focusConfirm: false,
        preConfirm: preConfirm,
        showCancelButton: showCancelButton
      }).then(() => {
        if (_.isFunction(callback)) {
          callback(null)
        }
      })
    }
  }

  static tryToLoadSwal () {
    if (_.isNull(swal)) {
      try {
        swal = require('sweetalert2')
      } catch (e) {
        swal = null
      }
    }
  }

  static threeOptionsAlert ({ title = 'Input', html = '', preConfirm, preDeny, position = Alerts.position.center, onBeforeOpen, cancelButtonColor = '#757575', showDenyButton = true, showCancelButton = true, confirmButtonText = 'Confirm', confirmButtonColor = '#4BB543', denyButtonText = 'Deny', denyButtonColor = '#3085D6', cancelButtonText = 'Cancel', allowOutsideClick = true, allowEscapeKey = true, callback, denyCallback, cancelCallback, customClass }) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      swal.fire({
        title: title,
        html: html,
        focusConfirm: false,
        preConfirm: preConfirm,
        preDeny: preDeny,
        position: position,
        willOpen: onBeforeOpen,
        allowOutsideClick,
        allowEscapeKey,
        customClass: customClass,
        showDenyButton: showDenyButton,
        showCancelButton: showCancelButton,
        confirmButtonText: confirmButtonText,
        confirmButtonColor: confirmButtonColor,
        denyButtonText: denyButtonText,
        denyButtonColor: denyButtonColor,
        cancelButtonText: cancelButtonText,
        cancelButtonColor: cancelButtonColor

      }).then((result) => {
        /* Read more about isConfirmed, isDenied below */
        if (result.isConfirmed) {
          if (_.isFunction(callback)) {
            callback(null, result.value)
          }
        } else if (result.isDenied) {
          if (_.isFunction(callback)) {
            denyCallback(null, result.value)
          }
        } else {
          if (_.isFunction(cancelCallback)) {
            cancelCallback(null)
          }
        }
      })
    }
  }

  static closeAlert () {
    swal.close()
  }

  static isVisible () {
    return swal.isVisible()
  }
}

Alerts.alertType = {
  warning: 'warning',
  error: 'error',
  success: 'success',
  info: 'info',
  question: 'question'
}

Alerts.position = {
  top: 'top',
  topStart: 'top-start',
  topEnd: 'top-end',
  center: 'center',
  centerStart: 'center-start',
  centerEnd: 'center-end',
  bottom: 'bottom',
  bottomStart: 'bottom-start',
  bottomEnd: 'bottom-end'
}

export default Alerts
