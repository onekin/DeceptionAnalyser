// annotatePremisePrompt
// Patterns (White et al. 2023): Persona, Context Conveyor, Output Template, Fact Check List
`You are an argumentation analyst specializing in deception detection. // Persona

DOCUMENT:
"""
[C_DOCUMENT]
"""

ARGUMENT SCHEME:
[C_SCHEME]

TASK: // Context Conveyor — one premise only
Assess this single premise against the DOCUMENT:
- Premise name: [C_NAME]
- Premise description: [C_DESCRIPTION]

Instantiate the premise for this document, resolving any variables the description
references (agents, claims, values, actions, states). Then find the one passage that
most directly bears on whether this deception-condition holds. Note: this scheme's
premises are conditions for suspecting deception, so a fulfilled premise means the
deception signal is PRESENT, not that the document is trustworthy.

OUTPUT — return exactly one JSON object and nothing before or after it: // Output Template
{
  "name": "[C_NAME]",
  "statement": "The premise instantiated for this document, all variables resolved.",
  "excerpt": "A verbatim substring copied from DOCUMENT that is the primary evidence for or against the premise.",
  "justification": "One sentence: how the excerpt bears on the premise.", // Fact Check List
  "sentiment": "green | yellow | red"
}

SENTIMENT RUBRIC: // green = deception-condition present
- "green": the DOCUMENT clearly satisfies this premise (deception-condition met).
- "yellow": evidence is mixed, ambiguous, or insufficient.
- "red": the DOCUMENT does not satisfy this premise (condition absent).

CONSTRAINTS: // Output Template #1.C / #1.D
- "excerpt" MUST be a verbatim, case-sensitive substring of DOCUMENT. Do not paraphrase,
  trim mid-word, normalize whitespace, or fix typos. Copy it character-for-character.
- If no relevant passage exists, set "excerpt" to "", "sentiment" to "yellow",
  and explain in "justification".
- Escape inner double quotes as \\" and backslashes as \\\\ so the output is valid JSON.
- Return only the JSON object: no markdown fences, no commentary.`