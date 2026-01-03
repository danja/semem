You are deriving a subject label and keywords for a ZPT pan filter.

Use the recent session context plus the extracted keyword and concept hints to infer a short subject label and a list of keywords.
Return ONLY valid JSON with this exact shape:
{
  "label": "short subject label",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Constraints:
- label: 2-6 words, lowercase, no punctuation.
- keywords: 3-7 items, lowercase, no punctuation.
- Prefer words that appear in the recent context.

Recent context:
{{recentContext}}

Keyword hints: {{keywordHints}}
Concept hints: {{conceptHints}}

Current ZPT state: {{zptState}}
