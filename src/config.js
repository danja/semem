// config.js
class Config {
  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.paths = {
      base: process.cwd(),
      config: './config'
    };
  }

  async load() {
    // Add configuration loading logic here
    return this;
  }
}

export const config = new Config();
