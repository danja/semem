/** Base class for programmatic API processors.
 * 
 * message is a JSON object with fields corresponding to the necessary parameters
 * process(message) returns a copy of the original messge, augmented with fields created in the relevant processing
 */
class Processor {

    constructor(config) {
        this.config = config;
    }

    async process(message) {

        // processing calls

        return message

    }
export default Processor