import _ from 'lodash'
import Alerts from '../utils/Alerts'
import LanguageUtils from '../utils/LanguageUtils'
let Swal = null
if (document && document.head) {
  Swal = require('sweetalert2')
}

class LLMClient {
  static async pdfBasedQuestion ({apiKey, documents, callback, prompt, llm, message = 'Please wait to the response'}) {
    Swal.fire({
      title: 'Asking ' + LanguageUtils.ucFirst(llm.modelType),
      text: message,
      allowEscapeKey: false,
      allowOutsideClick: false,
      onOpen: async () => {
        Swal.showLoading()
        const b = document.getElementById('swal2-title')
        b.innerText = 'Asking ' + LanguageUtils.ucFirst(llm.modelType)
        chrome.runtime.sendMessage({ scope: 'askLLM', cmd: llm.modelType, data: {documents: documents, apiKey: apiKey, query: prompt, llm: llm} }, function (response) {
          if (chrome.runtime.lastError) {
            Swal.close()
            Alerts.errorAlert({ title: 'Unable to ask ' + llm.modelType + ': ' + chrome.runtime.lastError.message })
          } else if (response.res.error) {
            Swal.close()
            Alerts.errorAlert({ title: 'Unable to ask ' + llm.modelType + ': ' + response.res.error })
          } else {
            // Swal.close()
            const jsonString = response.res
            console.log('ANSWER: ' + jsonString)
            let retrievedJSON = jsonString.substring(jsonString.indexOf('{') + 1)
            let lastIndex = retrievedJSON.lastIndexOf('}')
            retrievedJSON = retrievedJSON.substring(0, lastIndex)
            retrievedJSON = retrievedJSON.replace(/(\r\n|\n|\r)/gm, '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
            if (!retrievedJSON.startsWith('{')) {
              retrievedJSON = '{' + retrievedJSON
            }
            if (!retrievedJSON.endsWith('}')) {
              retrievedJSON = retrievedJSON + '}'
            }
            try {
              const jsonObject = JSON.parse(retrievedJSON)
              if (_.isFunction(callback)) {
                callback(jsonObject)
              }
            } catch (err) {
              Alerts.errorAlert({ title: 'Please try again. Try to repeat the question. Provided answer has been: ' + retrievedJSON + '. Error: ' + err.message })
            }
          }
        })
      }
    })
  }

  static async simpleQuestion ({apiKey, callback, prompt, llm}) {
    chrome.runtime.sendMessage({ scope: 'askLLM', cmd: llm.modelType, data: {apiKey: apiKey, query: prompt, llm: llm} }, function (response) {
      if (chrome.runtime.lastError) {
        Alerts.errorAlert({ title: 'Unable to ask OpenAI: ' + chrome.runtime.lastError.message })
      } else if (response.res.error) {
        Alerts.errorAlert({ title: 'Unable to ask OpenAI: ' + response.res.error })
      } else {
        const jsonString = response.res
        console.log('ANSWER: ' + jsonString)
        let retrievedJSON = jsonString.substring(jsonString.indexOf('{') + 1)
        let lastIndex = retrievedJSON.lastIndexOf('}')
        retrievedJSON = retrievedJSON.substring(0, lastIndex)
        retrievedJSON = retrievedJSON.replace(/(\r\n|\n|\r)/gm, '')
        if (!retrievedJSON.startsWith('{')) {
          retrievedJSON = '{' + retrievedJSON
        }
        if (!retrievedJSON.endsWith('}')) {
          retrievedJSON = retrievedJSON + '}'
        }
        try {
          const jsonObject = JSON.parse(retrievedJSON)
          if (_.isFunction(callback)) {
            callback(jsonObject)
          }
        } catch (err) {
          Alerts.showErrorToast('Please try again. Try to repeat the question. Provided answer has been: ' + retrievedJSON + '. Error: ' + err.message)
        }
      }
    })
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

export default LLMClient
