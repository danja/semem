// Ragno: Entity data model
export default class Entity {
  constructor({ name, isEntryPoint = true }) {
    this.name = name;
    this.isEntryPoint = isEntryPoint;
  }
}
