/**
 * Random Fact Generator for Testing
 * Generates random facts with known patterns for testing tell/ask workflows
 */

export class RandomFactGenerator {
  constructor() {
    this.subjects = ['flommings', 'bloonots', 'quityets', 'zepliars', 'looplongs', 'kibberts', 'munj', 'pliplings', 'norgs'];
    this.colors = ['turquoise', 'magenta', 'chartreuse', 'vermillion', 'cerulean', 'azure', 'crimson', 'amber'];
    this.types = ['creatures', 'plants', 'crystals', 'beings', 'entities', 'organisms', 'lifeforms'];
  }

  /**
   * Generate a random fact with the pattern: "{subject} are {color} {type}"
   * @returns {string} A random fact
   */
  generateFact() {
    const subject = this.subjects[Math.floor(Math.random() * this.subjects.length)];
    const color = this.colors[Math.floor(Math.random() * this.colors.length)];
    const type = this.types[Math.floor(Math.random() * this.types.length)];

    return `${subject} are ${color} ${type}`;
  }

  /**
   * Generate a unique fact with timestamp to ensure uniqueness
   * @returns {Object} Object with fact, subject, color, type, and timestamp
   */
  generateUniqueFact() {
    const timestamp = Date.now();
    const subject = this.subjects[Math.floor(Math.random() * this.subjects.length)];
    const color = this.colors[Math.floor(Math.random() * this.colors.length)];
    const type = this.types[Math.floor(Math.random() * this.types.length)];

    return {
      fact: `${subject}_${timestamp} are ${color} ${type}`,
      subject: `${subject}_${timestamp}`,
      color,
      type,
      timestamp
    };
  }

  /**
   * Generate a question based on a fact
   * @param {string} fact - The fact to generate a question for
   * @returns {string} A question about the fact
   */
  generateQuestion(fact) {
    const words = fact.split(' ');
    const subject = words[0];
    return `what color are ${subject}?`;
  }

  /**
   * Extract the color from a fact
   * @param {string} fact - The fact to extract color from
   * @returns {string} The color mentioned in the fact
   */
  extractColor(fact) {
    const words = fact.split(' ');
    return words[2]; // Pattern: "subject are COLOR type"
  }

  /**
   * Extract the subject from a fact
   * @param {string} fact - The fact to extract subject from
   * @returns {string} The subject mentioned in the fact
   */
  extractSubject(fact) {
    const words = fact.split(' ');
    return words[0]; // Pattern: "SUBJECT are color type"
  }
}

// Default export for convenience
export default new RandomFactGenerator();