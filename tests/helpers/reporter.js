import { SpecReporter } from 'jasmine-spec-reporter';

class CustomReporter {
    constructor() {
        this.specReporter = new SpecReporter({
            spec: {
                displayPending: true // Display pending (not fully implemented) specs
            }
        });
    }

    jasmineStarted() {
        this.specReporter.jasmineStarted.apply(this.specReporter, arguments);
    }

    suiteStarted() {
        this.specReporter.suiteStarted.apply(this.specReporter, arguments);
    }

    specStarted() {
        this.specReporter.specStarted.apply(this.specReporter, arguments);
    }

    specDone() {
        this.specReporter.specDone.apply(this.specReporter, arguments);
    }

    suiteDone() {
        this.specReporter.suiteDone.apply(this.specReporter, arguments);
    }

    jasmineDone() {
        this.specReporter.jasmineDone.apply(this.specReporter, arguments);
    }
}

export default CustomReporter;

/*
import { SpecReporter } from 'jasmine-spec-reporter';

jasmine.getEnv().clearReporters(); // Clear default console reporter
jasmine.getEnv().addReporter(new SpecReporter({
    spec: {
        displayPending: true // Display pending (not fully implemented) specs
    }
}));
*/