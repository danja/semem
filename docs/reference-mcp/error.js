function createErrorResponse(error, context = '') {
    const errorMessage = `${context}: ${error.message}`;
    console.error(errorMessage, error.stack);

    return {
        content: [
            {
                type: "text",
                text: errorMessage
            }
        ],
        isError: true
    };
}
