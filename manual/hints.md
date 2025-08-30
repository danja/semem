# User Hints and Tips

This document provides practical tips for using the Semem workbench effectively to get better search results and troubleshoot common issues.

## Getting Better Search Results

### Understanding Zoom Levels and Similarity Thresholds

The workbench's **Navigate** section controls how strict the similarity matching is when searching your stored knowledge. Different zoom levels use different similarity thresholds:

- **Entity**: 0.45 threshold - High precision, specific matches only
- **Unit**: 0.35 threshold - Medium-high precision, semantic chunks
- **Text**: 0.30 threshold - Medium precision, document sections
- **Community**: 0.25 threshold - Lower precision, thematic groups
- **Corpus**: 0.20 threshold - Low precision, broad discovery

### When Search Results Are Too Limited

If your **Ask** queries aren't finding content you know you've stored:

1. **Try a lower zoom level**: Click **Text**, **Community**, or **Corpus** in the Navigate section
2. **Re-ask your question**: The system will now use a more permissive similarity threshold
3. **Check what was stored**: Use the **Inspect → All Data** button to see what content is actually available

### Example Scenario

You've uploaded an ADHD document and ask "What is ADHD?" but get "no specific information" responses:

**Problem**: The default **Entity** zoom (0.45 threshold) is too strict for your document content

**Solution**: 
1. Click **Text** or **Corpus** in the Navigate section
2. Re-ask "What is ADHD?"
3. The lower threshold will now find your document chunks

## Improving Question Matching

### Try Different Phrasings

If your question doesn't match well, try variations:
- Instead of "What is ADHD?" try "Tell me about attention deficit disorder"
- Instead of "How to debug?" try "What are debugging techniques?"
- Use more specific terms that might appear in your stored documents

### Use the Augment Section

Before asking questions about a large document:
1. Paste the document or its key sections into **Augment → Target Content**
2. Select **Chunk Documents** operation
3. Click **Analyze** to break it into searchable chunks
4. Then use **Ask** to query the chunked content

## Troubleshooting Document Storage

### Documents Not Being Found in Search

1. **Check if chunking completed**: Look in the console logs for "Document chunking completed successfully"
2. **Verify content was stored**: Use **Inspect → All Data** to see stored chunks
3. **Try lower zoom levels**: Switch from Entity to Text/Community/Corpus
4. **Use the Augment section**: Manually chunk large documents with **Augment → Chunk Documents**

### Session Persistence Issues

If **Tell** operations aren't being found by **Ask** operations:
- Check the interaction counter in the top banner - it should increment
- Look for session ID consistency in console logs
- Both operations should show the same session ID

## Best Practices

### For Better Document Search
1. Use **Text** or **Community** zoom levels for document-based queries
2. Chunk large documents using the **Augment** section before querying
3. Use specific terminology from your documents in questions

### For Concept-Based Search
1. Use **Entity** zoom for precise concept matching
2. Store concepts using **Tell** with specific terminology
3. Use exact terms in your **Ask** queries

### Monitoring Your System
1. Watch the console logs for operation feedback
2. Use **Inspect → Session Info** to check system state
3. Check interaction counts to verify operations are being stored

## Common Patterns

### Document Q&A Workflow
1. **Tell**: Upload/paste document content (or use Document type)
2. **Augment**: Select "Chunk Documents" and analyze
3. **Navigate**: Set zoom to Text or Community
4. **Ask**: Query the chunked content

### Concept Building Workflow  
1. **Tell**: Store individual concepts with specific terms
2. **Navigate**: Use Entity zoom for precision
3. **Ask**: Use exact terminology for concept retrieval

### Knowledge Discovery Workflow
1. **Navigate**: Set zoom to Corpus for broad discovery
2. **Ask**: Use general questions to explore stored knowledge
3. **Navigate**: Narrow zoom level based on results
4. **Ask**: Refine questions for specific information