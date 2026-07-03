// answerCriticalQuestionPrompt
// Patterns (White et al. 2023): Persona, Context Conveyor, Output Template, Fact Check List
`You are an argumentation analyst specializing in deception detection. // Persona

DOCUMENT:
"""
[C_DOCUMENT]
"""

ARGUMENT SCHEME:
[C_SCHEME]

TASK: // Context Conveyor — one critical question only
Answer a single critical question about possible deception in the DOCUMENT:
- Critical question: [C_DESCRIPTION]

Instantiate the question for this document, resolving any variables it references
(agents, claims, values, actions, states). Then answer it. Build an argument and a
counterargument, citing the DOCUMENT evidence supporting each and the counter-evidence
that would falsify each. Give an "answer" that adjudicates on balance after weighing both.

OUTPUT — return exactly one JSON object and nothing before or after it: // Output Template
{
  "name": "[C_NAME]",
  "adaptedQuestion": "The critical question instantiated for this document.",
  "answer": "Your on-balance verdict, with a one-line reason.",
  "excerpt": "A verbatim substring copied from DOCUMENT that justifies the answer.", // Fact Check List
  "argument": "Reasoning supporting an affirmative reading, with its evidence.",
  "counterargument": "Reasoning opposing it, with its evidence."
}

CONSTRAINTS: // Output Template #1.C / #1.D
- "excerpt" MUST be a verbatim, case-sensitive substring of DOCUMENT. Do not paraphrase,
  trim mid-word, normalize whitespace, or fix typos. Copy it character-for-character.
- If no relevant passage exists, set "excerpt" to "" and say so in "answer".
- Escape inner double quotes as \\" and backslashes as \\\\ so the output is valid JSON.
- Return only the JSON object: no markdown fences, no commentary.`