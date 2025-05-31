// Ragno Attribute data model for Node.js ES modules
export default class Attribute {
  constructor({ text, summary, entity, provenance }) {
    this.text = text; // The attribute text or value
    this.summary = summary; // Short summary or description
    this.entity = entity; // Entity (URI or label) this attribute is linked to
    this.provenance = provenance; // Source/provenance info
  }
}
