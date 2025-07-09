Create examples/document/ConsumeQuestion.js which will receive a question as argument. The system should then :

1. Mint a URI to identify the question using src/utils/URIMinter.js
2. Create a ragno:Corpuscle for the question using the identifier. This will point to a ragno:TextElement containing the question text. Use the system described in 