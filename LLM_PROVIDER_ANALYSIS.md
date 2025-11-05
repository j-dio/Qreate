# LLM Provider Analysis for Qreate

## Problem Statement
- **Gemini 2.5 Flash**: Free but inconsistent, fails on >30 item exams, sometimes missing answer keys
- **ChatGPT (GPT-4o-mini)**: Consistent and reliable, but PAID service (expensive at scale)

## Goal
Find a **free or low-cost** LLM provider that:
1. Reliably generates exams with 10-200 questions
2. Consistently follows structured prompt format
3. Always includes answer keys
4. Can handle multi-file input
5. Sustainable for free tier with usage limits

---

## Option 1: **Groq API** (RECOMMENDED ⭐)

### Pros
- ✅ **Completely FREE** (14,400 requests/day limit)
- ✅ **10x faster** than OpenAI (300-500 tokens/sec)
- ✅ **Good instruction following** (Llama 3.1 70B/8B, Mixtral)
- ✅ **OpenAI-compatible API** (easy to integrate)
- ✅ **No credit card required**
- ✅ Should handle **200-300 users/day** comfortably

### Cons
- ⚠️ Rate limits (30 req/min, 14.4k req/day)
- ⚠️ Need to test consistency with exam generation
- ⚠️ Smaller context window than GPT-4 (8k-128k depending on model)

### Cost
- **FREE** for up to 14,400 requests/day
- If you exceed: Pay-as-you-go ($0.05-0.27 per 1M tokens)

### Implementation Effort
- **Low** - OpenAI-compatible API, swap base URL
- Change: `https://api.openai.com/v1` → `https://api.groq.com/openai/v1`

### Models Available
- `llama-3.1-70b-versatile` (best for complex tasks)
- `llama-3.1-8b-instant` (fast, good for simpler exams)
- `mixtral-8x7b-32768` (good balance)

### Recommended Usage Strategy
```typescript
// User limits with Groq free tier
FREE_TIER: {
  examsPerDay: 10,        // 10 exams * 200 users = 2000 requests/day (well within 14.4k limit)
  examsPerMonth: 100,
  maxQuestionsPerExam: 200
}
```

---

## Option 2: **Together AI** (Alternative Free Option)

### Pros
- ✅ Free tier: 6 million tokens/month
- ✅ Multiple models (Llama, Mixtral, Qwen)
- ✅ Good for open-source model access

### Cons
- ⚠️ Token-based limit (not request-based)
- ⚠️ Slower than Groq
- ⚠️ Less documentation/community

### Cost
- **FREE**: 6M tokens/month (~120-150 exams)
- Paid: $0.20-0.90 per 1M tokens

---

## Option 3: **OpenAI ChatGPT** (Current Working Solution)

### Pros
- ✅ **Proven consistency** (you've tested this)
- ✅ Best instruction following
- ✅ Large context window (128k tokens)
- ✅ Most reliable for complex exams

### Cons
- ❌ **EXPENSIVE** at scale
- ❌ Not sustainable for free tier
- ❌ Requires careful cost management

### Cost Analysis
**GPT-4o-mini:**
- Input: $0.150 / 1M tokens
- Output: $0.600 / 1M tokens

**Per exam (50 questions, 10k word file):**
- Input: ~13k tokens = $0.002
- Output: ~5k tokens = $0.003
- **Total: ~$0.005 per exam** (0.5 cents)

**Monthly cost scenarios:**
- 50 users, 10 exams/day: **$75/month**
- 100 users, 10 exams/day: **$150/month**
- 500 users, 10 exams/day: **$750/month**

**With strict limits:**
```typescript
ULTRA_LIMITED_FREE_TIER: {
  examsPerDay: 3,         // Very restrictive
  examsPerMonth: 20,
  maxQuestionsPerExam: 50
}
// Cost: $30/month for 100 users
```

---

## Option 4: **Anthropic Claude** (Alternative Paid)

### Pros
- ✅ Excellent instruction following
- ✅ Large context window (200k tokens)
- ✅ Good for complex reasoning

### Cons
- ❌ More expensive than OpenAI
- ❌ Not sustainable for free tier

### Cost
- Claude 3.5 Haiku: $0.80 / 1M input, $4.00 / 1M output
- **More expensive than GPT-4o-mini**

---

## Option 5: **Ollama (Local)** (User Self-Hosted)

### Pros
- ✅ **Completely free** (unlimited usage)
- ✅ **Privacy-focused** (runs on user's machine)
- ✅ No API rate limits
- ✅ Works offline

### Cons
- ❌ Requires 4-8GB model download
- ❌ User needs decent hardware (8GB+ RAM)
- ❌ Slower than cloud APIs
- ❌ Inconsistent performance (depends on user's hardware)

### Best Use Case
- Power users who want unlimited generation
- Privacy-conscious users
- Can be offered as "Advanced Option"

---

## Hybrid Approach: **Groq (Primary) + ChatGPT (Fallback)**

### Strategy
1. **Default**: Use Groq (free, fast)
2. **If Groq fails consistency check**: Retry with ChatGPT (costs money but reliable)
3. **Track success rate**: If Groq <90% success → switch more traffic to ChatGPT

### Implementation
```typescript
async generateExam(config) {
  // Try Groq first (free)
  const groqResult = await groqProvider.generate(config);

  // Validate exam structure
  if (validateExam(groqResult)) {
    return groqResult;
  }

  // Fallback to ChatGPT (costs money but reliable)
  console.log('Groq failed validation, using ChatGPT fallback');
  return await openaiProvider.generate(config);
}
```

### Cost
- 90% free (Groq), 10% paid (ChatGPT fallback)
- Estimated: **$15-30/month** for 100 users

---

## Recommendations

### **Immediate Action: Test Groq**
1. Sign up for free Groq API key
2. Test with your existing exam prompts (30, 50, 100, 200 items)
3. Compare consistency with ChatGPT
4. Measure: success rate, answer key presence, format accuracy

### **If Groq Works Well (>95% success rate)**
- ✅ Use Groq as primary provider
- ✅ Offer generous free tier: 10 exams/day
- ✅ Total cost: **$0/month** (within free limits)

### **If Groq is Inconsistent (like Gemini)**
- Option A: **Hybrid Groq + ChatGPT fallback**
  - Cost: $15-30/month for 100 users
  - User gets best of both worlds

- Option B: **ChatGPT with strict limits**
  - 3 exams/day, 20/month
  - Cost: $30-50/month for 100 users

- Option C: **Ollama as primary option**
  - Users download models locally
  - Completely free, unlimited
  - You provide easy setup wizard

### **Long-term Strategy**
1. **Free Tier**: Groq (or Ollama local option)
2. **Premium Tier** ($5-10/month):
   - Unlimited ChatGPT generations
   - Google Drive integration
   - Priority processing
   - Cloud sync

---

## Next Steps

1. **Test Groq API** (takes 1 hour)
   - Create test account
   - Run exam generation tests
   - Compare with ChatGPT quality

2. **Measure Results**
   - Success rate (% of valid exams)
   - Answer key presence (100% required)
   - Format accuracy
   - Speed comparison

3. **Make Decision**
   - If Groq >= 95% success: Use Groq (free!)
   - If Groq < 95% success: Hybrid approach or paid ChatGPT with limits

Would you like me to implement Groq integration so you can test it?
