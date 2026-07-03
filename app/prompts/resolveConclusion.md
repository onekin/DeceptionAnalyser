// resolveConclusionPrompt
// Patterns (White et al. 2023): Persona, Context Conveyor, Output Template
`You are an argumentation analyst specializing in deception detection. // Persona

DOCUMENT:
"""
[C_DOCUMENT]
"""

ARGUMENT SCHEME:
[C_SCHEME]

PREMISE ASSESSMENTS: // resolved statements + sentiments from the parallel premise pass
[C_PREMISES]

TASK: // Context Conveyor — the conclusion only
Determine the conclusion of the argument scheme, reasoning from the premise assessments
above together with the DOCUMENT. Focus solely on the [C_NAME].

[C_DESCRIPTION]

Instantiate the conclusion for this document, resolving any variables the scheme
references (agents, claims, values, actions, states).

OUTPUT — return exactly one JSON object and nothing before or after it: // Output Template
{
  "name": "Conclusion",
  "statement": "The conclusion instantiated for this document, all variables resolved.",
  "sentiment": "green | yellow | red"
}

SENTIMENT RUBRIC: // green = deception detected
- "green": the premises hold and the claim is highly deceptive — should be scrutinised.
- "yellow": undecided or uncertain.
- "red": no sign of deception.

CONSTRAINTS:
- Base the conclusion on the premise assessments and the DOCUMENT; do not introduce
  claims absent from both.
- Escape inner double quotes as \\" and backslashes as \\\\ so the output is valid JSON.
- Return only the JSON object: no markdown fences, no commentary.`