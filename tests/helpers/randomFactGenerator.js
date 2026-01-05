const facts = [
  'Neural networks are inspired by biological neural systems.',
  'SPARQL is the query language for RDF graphs.',
  'MCP defines a standard protocol for tool invocation.',
  'Semantic memory stores meaning-rich representations.',
  'RDF represents data as subject-predicate-object triples.'
];

const seen = new Set();

function pickFact() {
  for (let i = 0; i < facts.length * 2; i += 1) {
    const index = Math.floor(Math.random() * facts.length);
    const candidate = facts[index];
    if (!seen.has(candidate)) {
      seen.add(candidate);
      return candidate;
    }
  }

  const fallbackIndex = Math.floor(Math.random() * facts.length);
  const fallback = facts[fallbackIndex];
  seen.add(fallback);
  return fallback;
}

function extractSubject(fact) {
  if (!fact || typeof fact !== 'string') {
    return 'it';
  }

  const words = fact.replace(/[.?!]$/, '').split(' ');
  return words.slice(0, 3).join(' ').trim();
}

function generateQuestion(fact) {
  const subject = extractSubject(fact);
  return `what are ${subject} like?`;
}

function generateFact() {
  return pickFact();
}

function generateUniqueFact() {
  const fact = pickFact();
  return {
    fact,
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`
  };
}

export default {
  generateFact,
  generateQuestion,
  extractSubject,
  generateUniqueFact
};
