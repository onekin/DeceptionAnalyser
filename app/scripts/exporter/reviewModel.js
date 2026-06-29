/* eslint-disable */

export class ReviewReport {
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

  // Helper function to escape HTML and prevent XSS
  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  // Helper to render a section with title and content
  renderSection(title, content, className = 'section-content') {
    if (!content) return '';
    return `
      <div class="${className}">
        <h3>${this.escapeHtml(title)}</h3>
        <div class="content">${content}</div>
      </div>`;
  }

  // Helper to render a criterion card
  renderCriterionCard(assessedCriteria, isQuestion = false) {
    const { criterion, compile, alternative, fullQuestion, description } = assessedCriteria;
    
    let sentiment = '';
    if (compile && (compile.sentiment || (compile.answer && compile.answer.sentiment))) {
      sentiment = compile.sentiment || compile.answer.sentiment;
    }

    let html = `
      <div class="criterion-card ${isQuestion ? 'critical-question' : 'premise'}">
        <h2 class="criterion-title">
          ${this.escapeHtml(criterion.toUpperCase())}
          ${sentiment ? this.getSentimentImageHTML(sentiment) : ''}
        </h2>`;

    // Description section
    if (fullQuestion && fullQuestion.fullQuestion) {
      html += this.renderSection(
        isQuestion ? 'Question' : 'Description',
        this.escapeHtml(fullQuestion.fullQuestion),
        'section-content description'
      );
    } else if (description) {
      html += this.renderSection(
        'Description',
        this.escapeHtml(description),
        'section-content description'
      );
    }

    // Analysis section
    if (compile) {
      const compileLLM = (compile.answer && compile.answer.llm) ? compile.answer.llm : (compile.llm || '');
      const analysisText = (compile.answer && compile.answer.statement) 
        ? compile.answer.statement 
        : compile.answer;
      
      let analysisContent = this.escapeHtml(analysisText);
      if (compileLLM) {
        analysisContent += ` <span class="llm-badge">(based on ${this.escapeHtml(compileLLM)})</span>`;
      }
      
      html += this.renderSection('Analysis', analysisContent, 'section-content analysis');
    }

    // Arguments section (for critical questions)
    if (alternative) {
      html += this.renderSection('Arguments', this.escapeHtml(alternative), 'section-content arguments');
    }

    // Evidence section
    if (criterion !== 'Conclusion') {
      const criterionAnnotations = this.unsortedAnnotations.filter(e => e.criterion === criterion);
      if (criterionAnnotations && criterionAnnotations.length > 0) {
        const evidenceHtml = this.formatUnsortedAnnotations(criterionAnnotations, assessedCriteria);
        html += `
        <div class="section-content evidence">
          <h3>Evidence</h3>
          <div class="content">
            <ul class="evidence-list">${evidenceHtml}</ul>
          </div>
        </div>`;
      }
    }

    html += `
      </div>`;
    
    return html;
  }

  groupByCategoryHTML(){
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Enhanced CSS with professional styling
    const styles = `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 1200px;
        margin: 0 auto;
        padding: 40px 20px;
        background: #f8f9fa;
      }
      
      h1 {
        color: #1a365d;
        font-size: 2.5em;
        margin-bottom: 10px;
        border-bottom: 3px solid #2c5282;
        padding-bottom: 15px;
      }
      
      .report-date {
        color: #718096;
        font-size: 1.1em;
        margin-bottom: 30px;
        font-style: italic;
      }
      
      .criterion-card {
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin-bottom: 30px;
        padding: 25px;
        border-left: 4px solid #4299e1;
        transition: box-shadow 0.3s ease;
      }
      
      .criterion-card:hover {
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      
      .criterion-card.critical-question {
        border-left-color: #9f7aea;
      }
      
      .criterion-card.premise {
        border-left-color: #48bb78;
      }
      
      .criterion-title {
        color: #2d3748;
        font-size: 1.5em;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .section-content {
        margin-bottom: 20px;
      }
      
      .section-content h3 {
        color: #4a5568;
        font-size: 1.1em;
        margin-bottom: 10px;
        padding-bottom: 5px;
        border-bottom: 2px solid #e2e8f0;
      }
      
      .section-content .content {
        padding: 12px;
        background: #f7fafc;
        border-radius: 4px;
        line-height: 1.7;
      }
      
      .section-content.description .content {
        background: #ebf8ff;
        border-left: 3px solid #4299e1;
        padding-left: 15px;
      }
      
      .section-content.analysis .content {
        background: #f0fff4;
        border-left: 3px solid #48bb78;
        padding-left: 15px;
      }
      
      .section-content.arguments .content {
        background: #faf5ff;
        border-left: 3px solid #9f7aea;
        padding-left: 15px;
      }
      
      .section-content.evidence .content {
        background: #fffaf0;
        border-left: 3px solid #ed8936;
        padding-left: 15px;
      }
      
      .llm-badge {
        display: inline-block;
        background: #bee3f8;
        color: #2c5282;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.85em;
        font-weight: 600;
        margin-left: 8px;
      }
      
      .evidence-list {
        list-style: none;
      }
      
      .evidence-item {
        margin-bottom: 15px;
        padding: 12px;
        background: white;
        border-radius: 4px;
        border-left: 3px solid #cbd5e0;
      }
      
      .evidence-item:hover {
        background: #f7fafc;
        border-left-color: #4299e1;
      }
      
      .page-reference {
        display: inline-block;
        background: #edf2f7;
        color: #2d3748;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.9em;
        font-weight: 600;
        margin-right: 8px;
      }
      
      .highlight-text {
        font-style: italic;
        color: #2d3748;
        quotes: '\\201C' '\\201D';
      }
      
      .highlight-text:before {
        content: open-quote;
      }
      
      .highlight-text:after {
        content: close-quote;
      }
      
      .comments-section {
        margin-top: 10px;
        padding: 10px;
        background: #edf2f7;
        border-radius: 4px;
        font-size: 0.95em;
      }
      
      .comments-section strong {
        color: #2d3748;
        display: block;
        margin-bottom: 5px;
      }
      
      .comment-item {
        margin-left: 15px;
        padding: 5px 0;
        color: #4a5568;
      }
      
      .comment-item:before {
        content: '• ';
        color: #718096;
        font-weight: bold;
      }
      
      .sentiment-icon {
        height: 20px;
        width: 20px;
        vertical-align: middle;
        margin-left: 8px;
      }
      
      @media print {
        body {
          background: white;
          padding: 20px;
        }
        
        .criterion-card {
          page-break-inside: avoid;
          box-shadow: none;
          border: 1px solid #e2e8f0;
        }
      }
      
      @media (max-width: 768px) {
        body {
          padding: 20px 10px;
        }
        
        h1 {
          font-size: 2em;
        }
        
        .criterion-card {
          padding: 15px;
        }
      }
    `;

    // Build HTML document
    let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analysis Report</title>
  <style>${styles}</style>
</head>
<body>
  <h1>Report of the Analysis</h1>
  <p class="report-date">Generated on: ${currentDate}</p>
`;

    // Render Premises
    this._assessedCriteria.forEach(assessedCriteria => {
      if (assessedCriteria.group === 'Premises') {
        htmlContent += this.renderCriterionCard(assessedCriteria, false);
      }
    });

    // Render Critical Questions
    this._assessedCriteria.forEach(assessedCriteria => {
      if (assessedCriteria.group === 'Critical questions') {
        htmlContent += this.renderCriterionCard(assessedCriteria, true);
      }
    });

    htmlContent += `
</body>
</html>`;

    return htmlContent;
  }

  // Function to get sentiment image HTML
  getSentimentImageHTML(sentiment) {
    const green = chrome.runtime.getURL('/images/green.png')
    const yellow = chrome.runtime.getURL('/images/yellow.png')
    const red = chrome.runtime.getURL('/images/red.png')
    let imgSrc, altText;
    switch (sentiment) {
      case 'green':
        imgSrc = green
        altText = 'Positive'
        break;
      case 'yellow':
        imgSrc = yellow
        altText = 'Neutral'
        break;
      case 'red':
        imgSrc = red
        altText = 'Negative'
        break;
      default:
        return ''
    }
    return `<img src="${imgSrc}" alt="${altText}" style="height: 16px; margin-right: 4px; vertical-align: middle;">`;
  }

  // Function to format unsorted annotations
  formatUnsortedAnnotations(annotations, assessedCriteria, color) {
    if (!annotations || annotations.length === 0) return '';
    
    let html = '';
    
    for (let annotation of annotations) {
      if (!annotation.highlightText) continue;
      
      html += `
        <li class="evidence-item">`;
      
      // Add page reference if available
      if (annotation.page !== null) {
        html += `<span class="page-reference">Page ${annotation.page}</span>`;
      }
      
      // Add highlighted text
      html += `<span class="highlight-text">${this.escapeHtml(annotation.highlightText)}</span>`;
      
      // Add comments section if any comments exist
      const hasComments = (annotation.comment && annotation.comment !== "") ||
                         (annotation.factChecking && annotation.factChecking !== "") ||
                         (annotation.socialJudgement && annotation.socialJudgement !== "") ||
                         (annotation.clarifications && annotation.clarifications.length > 0);
      
      if (hasComments) {
        html += `
          <div class="comments-section">
            <strong>Comments:</strong>`;
        
        if (annotation.comment && annotation.comment !== "") {
          html += `
            <div class="comment-item">${this.escapeHtml(annotation.comment.replace(/(\r\n|\n|\r)/gm, ' '))}</div>`;
        }
        
        if (annotation.factChecking && annotation.factChecking !== "") {
          html += `
            <div class="comment-item">Fact checking suggests that ${this.escapeHtml(annotation.factChecking.replace(/(\r\n|\n|\r)/gm, ' '))}</div>`;
        }
        
        if (annotation.socialJudgement && annotation.socialJudgement !== "") {
          html += `
            <div class="comment-item">Social Judgement suggests that: ${this.escapeHtml(annotation.socialJudgement.replace(/(\r\n|\n|\r)/gm, ' '))}</div>`;
        }
        
        if (annotation.clarifications && annotation.clarifications.length > 0) {
          for (let clarification of annotation.clarifications) {
            html += `
            <div class="comment-item"><strong>${this.escapeHtml(clarification.question)}:</strong> ${this.escapeHtml(clarification.answer.replace(/(\r\n|\n|\r)/gm, ' '))}</div>`;
          }
        }
        
        html += `
          </div>`;
      }
      
      html += `
        </li>`;
    }
    
    return html;
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
