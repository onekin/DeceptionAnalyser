/* eslint-disable */

export class ReviewReport {
  constructor(){
    this._annotations = []
    this._assessedCriteria = []
    this._allCriteria = []
    this._documents = {}  // { docFingerprint: { label: string, assessedCriteria: AssessedTag[] } }
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
  // Add an assessed criteria to a specific document group
  insertDocumentAssessment(docId, docLabel, assessedTag) {
    if (!this._documents[docId]) {
      this._documents[docId] = { label: docLabel || docId, assessedCriteria: [] }
    }
    this._documents[docId].assessedCriteria.push(assessedTag)
  }
  get hasMultipleDocuments() {
    return Object.keys(this._documents).length > 0
  }
  get documents() {
    return this._documents
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
  renderCriterionCard(assessedCriteria, isQuestion = false, docId = '') {
    const { criterion, compile, assessments, description, allAssessments } = assessedCriteria;
    const hasMulti = assessedCriteria.hasMultipleLLMs;

    let html = `
      <div class="criterion-card ${isQuestion ? 'critical-question' : 'premise'}" data-criterion="${this.escapeHtml(criterion)}" data-doc="${this.escapeHtml(docId)}">`;

    // Description / Question section
    if (isQuestion) {
      if (description) {
        html += this.renderSection('Original Question', this.escapeHtml(description), 'section-content description');
      }
      if (assessments && assessments.adaptedQuestion && assessments.adaptedQuestion !== description) {
        html += this.renderSection('Adapted Question', this.escapeHtml(assessments.adaptedQuestion), 'section-content description');
      }
    } else if (description) {
      html += this.renderSection('Description', this.escapeHtml(description), 'section-content description');
    }

    // Render all assessments as panels (visible based on model filter)
    const panels = allAssessments && allAssessments.length > 0 ? allAssessments : [isQuestion ? assessments : compile].filter(Boolean);
    panels.forEach((a, idx) => {
      const llmName = a.llm || 'Unknown';
      const sentiment = (a.answer && a.answer.sentiment) || a.sentiment || '';
      html += `<div class="llm-panel" data-llm="${this.escapeHtml(llmName)}" data-idx="${idx}"${idx === 0 ? '' : ' hidden'}>`;
      // Title: CQs get plain name, premises get sentiment badge as title
      if (isQuestion) {
        html += `<h2 class="criterion-title">${this.escapeHtml(criterion.toUpperCase())}</h2>`;
      } else if (sentiment) {
        const isConclusion = (criterion === 'Conclusion');
        const statusText = isConclusion ? 'Conclusion is ' : 'premise is ';
        const statusEnd = sentiment === 'green' ? 'met' : sentiment === 'yellow' ? 'partially met' : sentiment === 'red' ? 'NOT met' : '';
        const icon = this.getSentimentImageHTML(sentiment);
        html += `<h2 class="criterion-title">${icon} ${this.escapeHtml(criterion.toUpperCase())} ${this.escapeHtml(statusText + statusEnd)}</h2>`;
      } else {
        html += `<h2 class="criterion-title">${this.escapeHtml(criterion.toUpperCase())}</h2>`;
      }
      html += this.renderSingleAssessment(a, isQuestion, criterion);
      html += '</div>';
    });

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

    html += '</div>';
    return html;
  }

  // Render a single assessment (used by both single-LLM and multi-LLM paths)
  renderSingleAssessment(assessment, isQuestion, criterion) {
    if (!assessment) return '';
    let html = '';

    if (isQuestion && assessment.answer) {
      let analysisContent = this.escapeHtml(assessment.answer);
      html += this.renderSection('Analysis', analysisContent, 'section-content analysis');
    } else if (assessment) {
      const analysisText = (assessment.answer && assessment.answer.statement)
        ? assessment.answer.statement
        : (assessment.answer || '');
      html += this.renderSection('Analysis', this.escapeHtml(analysisText), 'section-content analysis');
      if (assessment.excerpt || (assessment.answer && assessment.answer.excerpt)) {
        const excerpt = assessment.excerpt || assessment.answer.excerpt;
        html += this.renderSection('Excerpt', `<em>${this.escapeHtml(excerpt)}</em>`, 'section-content excerpt');
      }
    }

    // Arguments section (for critical questions)
    if (assessment && (assessment.argument || assessment.counterargument)) {
      html += `
        <table class="arguments-table">
          <tr><th>Argument</th><th>Counterargument</th></tr>
          <tr>
            <td>${this.escapeHtml(assessment.argument || '')}</td>
            <td>${this.escapeHtml(assessment.counterargument || '')}</td>
          </tr>
        </table>`;
    } else if (assessment && typeof assessment === 'string') {
      html += this.renderSection('Arguments', this.escapeHtml(assessment), 'section-content arguments');
    }

    return html;
  }

  groupByCategoryHTML(scope = 1){
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Compact, professional report styling
    const styles = `
      * { margin: 0; padding: 0; box-sizing: border-box; }

      body {
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        line-height: 1.5;
        color: #1a1a1a;
        max-width: 960px;
        margin: 0 auto;
        padding: 24px 16px;
        background: #fff;
      }

      h1 {
        color: #1a1a1a;
        font-size: 1.4em;
        font-weight: 700;
        margin-bottom: 4px;
        padding-bottom: 8px;
        border-bottom: 2px solid #e0e0e0;
      }

      .report-date {
        color: #888;
        font-size: 0.8em;
        margin-bottom: 18px;
      }

      .criterion-card {
        background: #fff;
        border: 1px solid #e8e8e8;
        border-left: 3px solid #555;
        margin-bottom: 12px;
        padding: 12px 14px;
      }

      .criterion-card.critical-question {
        border-left-color: #999;
        background: #fafafa;
        font-size: 0.92em;
      }

      /* Group accordion (Premises / Critical Questions) */
      .group-section {
        margin-bottom: 8px;
        border: 1px solid #eee;
      }
      .group-accordion-toggle {
        width: 100%;
        padding: 6px 12px;
        border: none;
        background: #fafafa;
        color: #444;
        font-size: 0.8em;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        text-align: left;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: background 0.15s;
      }
      .group-accordion-toggle:hover { background: #f0f0f0; }
      .group-accordion-toggle .accordion-arrow {
        font-size: 0.7em;
        width: 14px;
        text-align: center;
      }
      .group-badge {
        margin-left: auto;
        font-size: 0.85em;
        font-weight: 400;
        color: #999;
      }
      .group-content { padding: 0 8px 8px; }
      .group-content[hidden] { display: none; }



      .criterion-card.premise {
        border-left-color: #555;
      }

      .criterion-title {
        color: #1a1a1a;
        font-size: 0.95em;
        font-weight: 700;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .section-content {
        margin-bottom: 8px;
      }

      .section-content h3 {
        color: #555;
        font-size: 0.72em;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        margin-bottom: 3px;
        padding-bottom: 2px;
        border-bottom: 1px solid #eee;
      }

      .section-content .content {
        padding: 4px 0;
        line-height: 1.45;
        font-size: 0.88em;
      }

      .section-content.description .content {
        color: #444;
        font-style: italic;
      }

      .section-content.analysis .content {
        color: #1a1a1a;
      }

      .section-content.excerpt .content {
        color: #555;
        font-style: italic;
        padding-left: 8px;
        border-left: 2px solid #ddd;
      }

      .llm-badge {
        display: inline-block;
        background: #f0f0f0;
        color: #555;
        padding: 0 6px;
        border-radius: 3px;
        font-size: 0.8em;
        font-weight: 600;
        margin-left: 4px;
      }

      .evidence-list {
        list-style: none;
      }

      .evidence-item {
        margin-bottom: 6px;
        padding: 6px 8px;
        border-left: 2px solid #ddd;
        font-size: 0.85em;
      }

      .page-reference {
        display: inline-block;
        background: #f5f5f5;
        color: #666;
        padding: 1px 6px;
        border-radius: 2px;
        font-size: 0.85em;
        font-weight: 600;
        margin-right: 6px;
      }

      .highlight-text {
        font-style: italic;
        color: #333;
      }

      .highlight-text:before { content: '\\201C'; }
      .highlight-text:after { content: '\\201D'; }

      .comments-section {
        margin-top: 6px;
        font-size: 0.85em;
        color: #666;
      }

      .comments-section strong {
        font-weight: 600;
        color: #444;
      }

      .comment-item {
        margin-left: 12px;
        padding: 1px 0;
      }

      .comment-item:before {
        content: '• ';
        color: #999;
      }

      .criterion-title img {
        height: 16px;
        width: 16px;
        vertical-align: middle;
      }

      .llm-panel[hidden] { display: none; }

      /* Arguments table */
      .arguments-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 6px;
        font-size: 0.85em;
      }
      .arguments-table th {
        background: #f5f5f5;
        padding: 4px 8px;
        text-align: left;
        font-weight: 600;
        color: #555;
        border: 1px solid #e8e8e8;
        font-size: 0.75em;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .arguments-table td {
        padding: 6px 8px;
        border: 1px solid #e8e8e8;
        vertical-align: top;
        line-height: 1.4;
      }

      /* Report toolbar */
      .report-toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        padding: 8px 12px;
        background: #fafafa;
        border: 1px solid #e8e8e8;
        flex-wrap: wrap;
      }
      .report-toolbar label {
        font-size: 0.75em;
        font-weight: 600;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .report-toolbar select {
        padding: 3px 8px;
        border: 1px solid #ddd;
        border-radius: 3px;
        font-size: 0.85em;
        color: #333;
        background: #fff;
        min-width: 140px;
      }
      .report-toolbar .toolbar-spacer { flex: 1; }
      .btn-print {
        padding: 4px 14px;
        border: 1px solid #ccc;
        border-radius: 3px;
        background: #fff;
        color: #555;
        font-size: 0.8em;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
      }
      .btn-print:hover { background: #f0f0f0; }

      @media print {
        body { padding: 12px; background: #fff; font-size: 11px; }
        .criterion-card { break-inside: avoid; border: 1px solid #ddd; margin-bottom: 8px; }
        .report-toolbar { display: none; }
        .doc-accordion-toggle { background: none; padding: 6px 10px; }
      }

      @media (max-width: 768px) {
        body { padding: 12px 8px; }
        h1 { font-size: 1.2em; }
        .criterion-card { padding: 10px; }
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

  <div class="report-toolbar">
    <label for="docFilter">PDF:</label>
    <select id="docFilter"></select>
    <label for="modelFilter">Model:</label>
    <select id="modelFilter"></select>
    <span class="toolbar-spacer"></span>
    <button id="btnPrint" class="btn-print" title="Save as PDF">🖶 Print / PDF</button>
  </div>
`;

    if (this.hasMultipleDocuments) {
      // Render all documents (filtered by dropdown)
      const docIds = Object.keys(this._documents);
      docIds.forEach((docId, docIdx) => {
        const doc = this._documents[docId];

        // Conclusion first (outside accordion)
        const docConclusion = doc.assessedCriteria.filter(ac => ac.group === 'Premises' && ac.criterion === 'Conclusion');
        const docPremises = doc.assessedCriteria.filter(ac => ac.group === 'Premises' && ac.criterion !== 'Conclusion');
        docConclusion.forEach(ac => { htmlContent += this.renderCriterionCard(ac, false, docId); });
        // Other premises as accordion group
        if (docPremises.length > 0) {
          htmlContent += `
  <div class="group-section">
    <button class="group-accordion-toggle">
      <span class="accordion-arrow">▾</span>
      Premises
      <span class="group-badge">${docPremises.length} premises</span>
    </button>
    <div class="group-content">`;
          docPremises.forEach(ac => { htmlContent += this.renderCriterionCard(ac, false, docId); });
          htmlContent += '</div></div>';
        }

        // Render critical questions as accordion group
        const docCQs = doc.assessedCriteria.filter(ac => ac.group === 'Critical questions');
        if (docCQs.length > 0) {
          htmlContent += `
  <div class="group-section">
    <button class="group-accordion-toggle">
      <span class="accordion-arrow">▾</span>
      Critical Questions
      <span class="group-badge">${docCQs.length} questions</span>
    </button>
    <div class="group-content">`;
          docCQs.forEach(ac => { htmlContent += this.renderCriterionCard(ac, true, docId); });
          htmlContent += '</div></div>';
        }

      });
    }

    // Inject doc labels as a JS map for the dropdown
    const docLabelsJson = JSON.stringify(Object.fromEntries(Object.entries(this._documents).map(([id, d]) => [id, d.label])));

    htmlContent += `
</body>
<script>
(function() {
  // ---- 1. Build doc-models map from rendered cards ----
  var docFilter = document.getElementById('docFilter');
  var modelFilter = document.getElementById('modelFilter');
  var DOC_LABELS = ${docLabelsJson};

  var docModels = {};
  document.querySelectorAll('.criterion-card[data-doc]').forEach(function(card) {
    var doc = card.dataset.doc;
    if (!doc) return;
    if (!docModels[doc]) docModels[doc] = new Set();
    card.querySelectorAll('.llm-panel[data-llm]').forEach(function(el) {
      if (el.dataset.llm) docModels[doc].add(el.dataset.llm);
    });
  });

  // ---- 2. Populate doc dropdown ----
  var docIds = Object.keys(docModels);
  docIds.forEach(function(d) {
    var opt = document.createElement('option');
    opt.value = d;
    opt.textContent = DOC_LABELS[d] || d;
    docFilter.appendChild(opt);
  });

  // ---- 3. Populate model dropdown for selected doc ----
  function populateModelFilter(docId) {
    var sel = modelFilter.value;
    modelFilter.innerHTML = '';
    var models = docModels[docId] || new Set();
    if (models.size === 0) {
      Object.values(docModels).forEach(function(s) { s.forEach(function(m) { models.add(m); }); });
    }
    models.forEach(function(m) {
      var opt = document.createElement('option');
      opt.value = m; opt.textContent = m;
      if (m === sel) opt.selected = true;
      modelFilter.appendChild(opt);
    });
  }
  if (docIds.length > 0) populateModelFilter(docIds[0]);
  else {
    var allM = new Set();
    document.querySelectorAll('.llm-panel[data-llm]').forEach(function(el) {
      if (el.dataset.llm) allM.add(el.dataset.llm);
    });
    allM.forEach(function(m) {
      var opt = document.createElement('option');
      opt.value = m; opt.textContent = m;
      modelFilter.appendChild(opt);
    });
  }

  // Apply initial filter (first doc, first model only)
  applyFilters();

  // ---- 4. Filtering ----
  function applyFilters() {
    var selDoc = docFilter.value;
    var selModel = modelFilter.value;

    document.querySelectorAll('.criterion-card[data-doc]').forEach(function(card) {
      var showDoc = !selDoc || card.dataset.doc === selDoc;
      var hasVisible = false;
      card.querySelectorAll('.llm-panel[data-llm]').forEach(function(panel) {
        var show = !selModel || panel.dataset.llm === selModel;
        panel.hidden = !show;
        if (show) hasVisible = true;
      });
      var hasPanels = card.querySelectorAll('.llm-panel[data-llm]').length > 0;
      card.style.display = hasPanels ? (showDoc && hasVisible ? '' : 'none') : (showDoc ? '' : 'none');
    });

    document.querySelectorAll('.group-section').forEach(function(group) {
      var vis = group.querySelectorAll('.criterion-card:not([style*="display: none"])');
      group.style.display = vis.length > 0 ? '' : 'none';
    });
  }

  docFilter.addEventListener('change', function() {
    populateModelFilter(this.value);
    applyFilters();
  });
  modelFilter.addEventListener('change', applyFilters);

  // ---- 5. Accordions (groups) ----
  document.querySelectorAll('.group-accordion-toggle').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var parent = this.closest('.group-section');
      var content = parent.querySelector('.group-content');
      var arrow = this.querySelector('.accordion-arrow');
      var isCollapsed = parent.classList.contains('collapsed');
      if (isCollapsed) {
        parent.classList.remove('collapsed');
        if (content) content.hidden = false;
        if (arrow) arrow.textContent = '\\u25BE';
      } else {
        parent.classList.add('collapsed');
        if (content) content.hidden = true;
        if (arrow) arrow.textContent = '\\u25B8';
      }
    });
  });

  // Print button
  document.getElementById('btnPrint').addEventListener('click', function() { window.print(); });
})();
</script>
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
  constructor({ criterion, group = null, compile = null, assessments = null, description = null, allAssessments = null }) {
    this._criterion = criterion
    this._group = group
    this._compile = compile
    this._assessments = assessments
    this._description = description
    this._allAssessments = allAssessments  // array of {llm, answer, sentiment, excerpt, ...} for multi-LLM scopes
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
  get assessments(){
    return this._assessments
  }
  get description(){
    return this._description
  }
  get allAssessments(){
    return this._allAssessments
  }
  get hasMultipleLLMs(){
    return this._allAssessments && this._allAssessments.length > 1
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
