The project I've spent most time on - nearly a year, on & off, is : https://github.com/danja/semem 
The name caused teenage giggles on Reddit. And for me :)
Anyway, "Semantic Web Memory for Intelligent Agents". It's not useful yet, mostly due to me over-relying on Claude to write the code. 
(Not what I intended doing. What I'm planned doing was playing with multiple independent LLM-based bots in a (XMPP) chatroom. Fun stuff - not this rabbit hole!)

I'm using "memory" as an umbrella, there are a couple of different aspects. First one is the obvious - having material in conversations with LLMs being somehow persistent. A part that I reckon has a lot of potential is all about trying to get the right material into the context, navigating it. Another part is being able to connect with linked data anywhere - semweb, innit. (I've had it querying Wikidata).

So far the most successful bit has been the ability to Tell it things and Ask it things, via chat interface or more directly, like uploading a doc.

I had been playing with graph RAG a bit, but not in a very coordinated way. Then I stumbled on the NodeRAG paper : https://arxiv.org/abs/2504.11544 which has a nice system. With a few tweaks I turned their model into an ontology and pretty much recreated their system just with a SPARQL store as backend. Then I was pondering how to navigate the knowledgebase and came up with - Claude's words - The ZPT navigation system provides a spatial metaphor for exploring knowledge spaces in Semem. It enables users to navigate corpus data at different levels of abstraction (zoom), filter by domains or topics (pan), and choose different analytical perspectives (tilt). Cue another ontology.

Under the hood there are a kind-of 3 layers to the information processing : chatty LLM, similarity search via embeddings & SPARQL store.




