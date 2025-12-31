class LensState {
  constructor() {
    this.key = 'workbench.zptLens';
  }

  get() {
    try {
      const raw = window.localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  set(nextState) {
    try {
      window.localStorage.setItem(this.key, JSON.stringify(nextState));
    } catch (error) {
      // Ignore storage failures
    }
  }
}

export const lensState = new LensState();
