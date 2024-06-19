/* eslint-disable */

export class Review {
  constructor(){
    this._annotations = []
    this._assessedCriteria = []
    this._allCriteria = []
  }
  insertAnnotation(annotation){
    this._annotations.push(annotation)
  }

  insertAssessedCriteria(annotation){
    this._assessedCriteria.push(annotation)
  }
  insertCriteria(annotation){
    this._allCriteria.push(annotation)
  }
  groupByCriterionInsideLevel (){
    return this._annotations;
  }
  get annotations(){
    return this.groupByCriterionInsideLevel("Strength")
  }
  get typos(){
    return this.annotations.filter((e) => {return e.criterion==="Typos"})
  }
  get presentationErrors(){
    let that = this
    let groups = []
    let presentationAnnotations = this._annotations.filter((el) => {return el.group === "Presentation"})
    for(let i in presentationAnnotations){
      if(groups.find((el) => {return el.annotations[0].criterion===presentationAnnotations[i].criterion})!=null) continue
      groups.push(new AnnotationGroup(presentationAnnotations.filter((el) => {return el.criterion===presentationAnnotations[i].criterion}),that))
    }
    return groups
  }

  get unsortedAnnotations(){
    //return this.annotations.filter((e) => {return e.criterion!=="Typos"&&(e.level==null||e.level=="")})
    return this.annotations.filter((e) => {return e.group!=="Presentation"&&(e.level==null||e.level=="")})
  }

  isFirstComment (t) {
    if (t.endsWith("COMMENTS: ")) {
      return ''
    } else {
      return '\r\n\t\t-'
    }
  }

  isFirstCommentHTML (t) {
    if (t.endsWith("COMMENTS: ")) {
      return ''
    } else {
      return '\r\n\n-'
    }
  }

  groupByCategoryHTML(){
    // Starting HTML structure with internal CSS
    let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Report of the analysis</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
            h1, h2, h3 { color: navy; }
            h2 { border-bottom: 1px solid #ddd; padding-bottom: 5px; }
            .criterion { margin-top: 20px; }
            .excerpt { font-style: italic; margin-bottom: 10px; display: flex; align-items: center; }
            .excerpt img { margin-right: 5px; }
            .editable { margin-left: 20px; background-color: #f0f0f0; padding: 10px; }
            .editable textarea { width: 100%; height: 100px; }
      </style>
    </head>
    <body>
    `;
    // Adding date at the top
    htmlContent += "<h1>Report of the analysis </h1><p>Date: "+ new Date().toLocaleDateString() + "</p>";

    // Premises
    this._assessedCriteria.forEach( (assessedCriteria) => {
      if (assessedCriteria.group === 'Premises') {
        htmlContent += "<div class='criterion'><h2>"+ assessedCriteria.criterion.toUpperCase() + "</h2>";

        if (assessedCriteria.compile) {
          if (assessedCriteria.fullQuestion && assessedCriteria.fullQuestion.fullQuestion) {
            htmlContent += "<div class='editable'><h3>Description: </h3>" + assessedCriteria.fullQuestion.fullQuestion + "</div>";
          } else if (assessedCriteria.description) {
            htmlContent += "<div class='editable'><h3>Description: </h3>" + assessedCriteria.description + "</div>";
          }
          htmlContent += "<div class='editable'><h3>Analysis: </h3>" + assessedCriteria.compile.answer + "</div>";
          htmlContent += "<div class='editable'><h3>Evidence: </h3>"
          const criterionUnsortedAnnotations = this.unsortedAnnotations.filter((e) => {return e.criterion === assessedCriteria.criterion})
          if (criterionUnsortedAnnotations && criterionUnsortedAnnotations.length > 0) {
            htmlContent += this.formatUnsortedAnnotations(criterionUnsortedAnnotations, assessedCriteria);
          }
          htmlContent += "</div>"
        }
        htmlContent += "</div>"
      }
    });
    // Critical Questions
    this._assessedCriteria.forEach( (assessedCriteria) => {
      if (assessedCriteria.group === 'Critical questions') {
        htmlContent += "<div class='criterion'><h2>" + assessedCriteria.criterion.toUpperCase() + "</h2>";
        if (assessedCriteria.compile) {
          if (assessedCriteria.description) {
            htmlContent += "<div class='editable'><h3>Description: </h3>" + assessedCriteria.description + "</div>";
          }
          if (assessedCriteria.fullQuestion && assessedCriteria.fullQuestion.fullQuestion) {
            htmlContent += "<div class='editable'><h3>Question: </h3>" + assessedCriteria.fullQuestion.fullQuestion + "</div>";
          }
          htmlContent += "<div class='editable'><h3>Analysis: </h3>" + assessedCriteria.compile.answer + "</div>";
        }
        if (assessedCriteria.alternative) {
          htmlContent += "<div class='editable'><h3>Arguments: </h3>" + assessedCriteria.alternative + "</div>";
        }
        htmlContent += "<div class='editable'><h3>Evidence: </h3>"
        const criterionUnsortedAnnotations = this.unsortedAnnotations.filter((e) => {return e.criterion === assessedCriteria.criterion})
        if (criterionUnsortedAnnotations && criterionUnsortedAnnotations.length > 0) {
          htmlContent += this.formatUnsortedAnnotations(criterionUnsortedAnnotations, assessedCriteria);
        }
        htmlContent += "</div>"
        htmlContent += "</div>"
      }
    });
    // Closing HTML tags
    htmlContent += "</body></html>";

    return htmlContent;
  }

// Function to format unsorted annotations
  formatUnsortedAnnotations(annotations, assessedCriteria, color) {
    let t = "";
    if (annotations.length > 0) {
      for (let i in annotations) {
        if (annotations[i].highlightText === null) continue
        t += "<div className='excerpt'>"
        t += `<li style="color: ${color};">`;
        if (annotations[i].page !== null) t += '(Page ' + annotations[i].page + '): '
        t += '"' + annotations[i].highlightText + '". ' + '</li>';
        if ((annotations[i].comment != null && annotations[i].comment != "") || (annotations[i].factChecking != null && annotations[i].factChecking != "") || (annotations[i].socialJudgement != null && annotations[i].socialJudgement != "") || (annotations[i].clarifications != null && annotations[i].clarifications != "")) {
          t += "<div class='editable'><textarea>COMMENTS: "
          if (annotations[i].comment != null && annotations[i].comment != "") t += this.isFirstCommentHTML(t) + + annotations[i].comment.replace(/(\r\n|\n|\r)/gm, '');
          if (annotations[i].factChecking != null && annotations[i].factChecking != "") t += this.isFirstCommentHTML(t) + 'Fact checking suggests that ' + annotations[i].factChecking.replace(/(\r\n|\n|\r)/gm, '');
          if (annotations[i].socialJudgement != null && annotations[i].socialJudgement != "") t += this.isFirstCommentHTML(t) + 'Social Judgement suggests that: ' + annotations[i].socialJudgement.replace(/(\r\n|\n|\r)/gm, '');
          if (annotations[i].clarifications && annotations[i].clarifications.length > 0) {
            for (let j in annotations[i].clarifications) {
              t += this.isFirstCommentHTML(t) + '[' + annotations[i].clarifications[j].question + ']: ' + annotations[i].clarifications[j].answer.replace(/(\r\n|\n|\r)/gm, '');
            }
          }
          t += '</textarea></div>'
        }
        t += '</div>'
      }
    }
    return t;
  }

}

export class Annotation {
  constructor(id,criterion,level,group,highlightText,page,comment,clarifications,factChecking,socialJudgement){
    this._criterion = criterion
    this._level = level
    this._group = group
    this._highlightText = highlightText
    this._page = page
    this._comment = comment
    this._id = id
    this._clarifications = clarifications
    this._factChecking = factChecking
    this._socialJudgement = socialJudgement
  }
  get criterion(){
    return this._criterion
  }
  get level(){
    return this._level
  }
  get group(){
    return this._group
  }
  get highlightText(){
    return this._highlightText
  }
  get page(){
    return this._page
  }
  get comment(){
    return this._comment
  }

  get id(){
    return this._id
  }

  get clarifications(){
    return this._clarifications
  }

  get factChecking(){
    return this._factChecking
  }

  get socialJudgement(){
    return this._socialJudgement
  }
}

export class AssessedTag {
  constructor({ criterion, group = null, compile = null, alternative = null, fullQuestion = null, description = null }) {
    this._criterion = criterion
    this._group = group
    this._compile = compile
    this._alternative = alternative
    this._fullQuestion = fullQuestion
    this._description = description
  }
  get criterion(){
    return this._criterion
  }
  get group(){
    return this._group
  }
  get compile(){
    return this._compile
  }
  get alternative(){
    return this._alternative
  }
  get fullQuestion(){
    return this._fullQuestion
  }
  get description(){
    return this._description
  }
}

export class AnnotationGroup {
  constructor (annotations, review) {
    this._annotations = annotations
    this._review = review
  }

  get annotations () {
    return this._annotations
  }

  toString () {
    let t = this._annotations[0].criterion + ':'
    for (let i in this._annotations) {
      if (this._annotations[i].highlightText === null) continue
      t += '\r\n\t* '
      if (this._annotations[i].page !== null) t += '(Page ' + this._annotations[i].page + '): '
      t += '"' + this._annotations[i].highlightText + '". ';
      if (this._annotations[i].comment != null && this._annotations[i].comment != "") t += '\r\n\t' + this._annotations[i].comment.replace(/(\r\n|\n|\r)/gm, '');
    }
    return t
  }
}
