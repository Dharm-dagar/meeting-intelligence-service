# AI Approach

## Model & Provider

**Provider**: Groq  
**Model**: `llama3-8b-8192`  
**Temperature**: 0.1 (near-deterministic for consistency)

---

## Prompt Design

The system uses a two-message structure:

### System Prompt
Sets strict rules for the model:
- Only use information explicitly in the transcript
- Every insight MUST include citations with transcript timestamps
- Do NOT invent attendees, outcomes, or action items
- Return ONLY valid JSON — no markdown, no preamble

### User Prompt
Provides full context:
- Meeting title and participants
- Formatted transcript with timestamps and speakers
- Clear instruction to return structured JSON

### Output Schema
```json
{
  "summary": [{ "text": "...", "citations": [{"timestamp": "00:10"}] }],
  "actionItems": [{ "task": "...", "assignee": "...", "dueDate": null, "citations": [...] }],
  "decisions": [{ "text": "...", "citations": [...] }],
  "followUpSuggestions": [{ "text": "...", "citations": [...] }]
}
```

---

## Citation Strategy

Every generated insight must reference the timestamp(s) from the transcript that it was derived from. This creates an auditable chain: **insight → transcript line**.

For example:
- Summary: "Team plans to launch next Friday" → cites `00:10` where John says "We should launch next Friday"
- Action Item: "Prepare release notes" → cites `00:20` where Alice says "I will prepare release notes"

This allows users to verify every AI claim by jumping directly to the source in the transcript.

---

## Hallucination Prevention

### At Prompt Level
1. System prompt explicitly forbids inventing any information
2. Model is instructed that every claim needs a citation
3. Low temperature (0.1) minimizes creative/speculative output
4. Structured JSON output limits the model's ability to add unstructured commentary

### At Application Level
1. `validateGrounding()` checks every citation timestamp exists in the actual transcript
2. Warnings are logged for any timestamps that don't match
3. JSON parsing errors (malformed AI output) are caught and return a `502` with a clear error code
4. Markdown code fences are stripped before JSON parsing (common LLM output artifact)

---

## Output Validation Strategy

1. **JSON parsing**: Wrapped in try/catch, fails gracefully with `AI_PARSE_ERROR`
2. **Timestamp validation**: All citation timestamps are checked against the actual transcript
3. **Provider errors**: HTTP errors from Groq are caught and re-wrapped as `502 AI_PROVIDER_ERROR` with the original message
4. **Timeout**: 30-second timeout on API calls prevents hanging requests

---

## Known Limitations

1. **Short transcripts**: Very short transcripts may produce fewer citations than expected
2. **Timestamp format**: The model expects simple timestamp strings (e.g., "00:10"). Complex formats like "00:01:30.500" may cause citation mismatches
3. **Non-English transcripts**: The model handles multiple languages but citation accuracy may vary
4. **Context window**: Very long transcripts (100+ entries) may exceed the model's effective context window, reducing analysis quality
5. **JSON reliability**: llama3-8b occasionally wraps output in markdown fences despite instructions — this is handled by stripping fences before parsing, but a retry strategy would improve robustness in production
6. **Due date extraction**: The model often returns `null` for due dates unless explicitly mentioned in the transcript — this is correct behavior (no hallucination), but may be limiting
