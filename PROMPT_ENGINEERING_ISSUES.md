# Prompt Engineering Issues & Investigation Notes

## Current Problem: Literal Instruction Interpretation

**Date:** November 13, 2025  
**Status:** 🔍 Under Investigation  
**Priority:** Medium (does not affect core functionality)

### Issue Description

The Groq AI (llama-3.3-70b-versatile) occasionally includes literal placeholder instructions in the generated exam content instead of following them as guidance.

**Example of problem:**
```
Multiple Choice:
1. What is the primary function of...?
[Continue with questions 2-80 in same format...] <- This appears literally in output
```

**Expected behavior:**
```
Multiple Choice:
1. What is the primary function of...?
2. Which of the following is...?
3. The process of cell division involves...?
[...continues with actual questions]
```

### Impact Assessment

- **Severity:** Medium - produces unprofessional exam output
- **Frequency:** Inconsistent - affects custom configurations more than presets
- **Workaround:** Presets work well, users can use those for reliable generation
- **User Experience:** Confusing when placeholder text appears in final PDF

### Investigation History

#### Approach 1: Static Template Refinement ❌
**Attempted:** Improved the original static prompt template
**Result:** AI still included unwanted question types and placeholder text
**Issue:** Generic template tried to cover all possible question type combinations

#### Approach 2: Dynamic Prompt Generation ⚠️
**Attempted:** Built type-specific prompts based on user's selected question types
**Implementation:** 
- `buildDynamicFormatSections()` - generates format examples only for selected types
- `buildTypeSpecificRules()` - quality rules specific to chosen question types
- Eliminated generic "Continue for all requested question types..." text

**Partial Success:** 
- ✅ No unwanted question types (e.g., no fill-in-blanks when not selected)
- ✅ Type-specific quality rules (anti-bias for multiple choice)
- ⚠️ Still includes some literal instructional text

#### Approach 3: Concrete Examples vs Placeholders ⚠️
**Attempted:** Replaced bracket placeholders with concrete examples
**Before:** `[Question text here?]`
**After:** `What is the primary function of...?`
**Result:** Reduced but did not eliminate literal interpretation

#### Approach 4: Explicit Anti-Literal Instructions ⚠️
**Attempted:** Added strong warnings against including instructional text
```
**CRITICAL:** 
- DO NOT include any instructional text in your output
- DO NOT include phrases like "Continue with", "Generate all"
- ONLY output the actual exam content and answer key
```
**Result:** Some improvement but issue persists intermittently

### Working Cases (For Comparison)

**✅ Presets Work Well**
- Standard exam presets generate clean, professional output
- Suggests the AI can produce correct format when configuration is simpler
- May indicate complexity of custom configurations causes confusion

**✅ Smaller Exams**
- 30-50 question exams tend to work better than 100-question exams
- May be related to token limits or prompt complexity at scale

### Technical Context

**Model:** llama-3.3-70b-versatile  
**Token Limit:** 32,768 (increased from 16,384)  
**Temperature:** 0.7  
**Prompt Structure:** Dynamic generation based on selected question types

**Current Implementation Files:**
- `src/main/services/GroqProvider.ts` - Core prompt generation
- `buildExamPrompt()` - Main prompt builder
- `buildDynamicFormatSections()` - Type-specific format examples
- `buildTypeSpecificRules()` - Quality rules per question type

### Theories for Investigation

#### Theory 1: Model-Specific Behavior
**Hypothesis:** llama-3.3-70b-versatile has specific prompt interpretation patterns  
**Test:** Try different models or compare with other Groq models  
**Evidence:** Other AI models might handle instruction-following differently

#### Theory 2: Token Position Sensitivity
**Hypothesis:** Instructions at different prompt positions have varying effectiveness  
**Test:** Move critical "no literal text" instructions to different prompt locations  
**Evidence:** Some instructions might be "forgotten" due to attention mechanisms

#### Theory 3: Configuration Complexity Threshold
**Hypothesis:** Complex custom configs overwhelm the model's instruction-following  
**Test:** Gradually increase complexity from simple presets to full custom  
**Evidence:** Presets work well, custom configs struggle

#### Theory 4: Prompt Length Impact
**Hypothesis:** Very long prompts dilute critical instructions  
**Test:** Create minimal prompts with only essential instructions  
**Evidence:** Current prompts are quite comprehensive and might be overwhelming

### Next Investigation Steps

#### Phase 1: Model Behavior Analysis
1. **A/B Test Simple vs Complex Prompts**
   - Test same content with minimal prompt vs current comprehensive prompt
   - Identify if prompt length is a factor

2. **Instruction Position Testing**
   - Place "no literal text" instructions at beginning, middle, and end
   - Test which position has most impact

3. **Progressive Complexity Testing**
   - Start with working preset configurations
   - Gradually add complexity until failure point is identified

#### Phase 2: Alternative Approaches
1. **Few-Shot Learning**
   - Provide 2-3 complete example exams in prompt
   - Show exact desired output format through examples

2. **Multi-Step Generation**
   - Generate exam outline first, then questions
   - Reduce cognitive load on model per generation step

3. **Post-Processing Cleanup**
   - Accept that some literal text might appear
   - Build regex-based cleanup to remove common literal instructions

#### Phase 3: Model Alternatives
1. **Test Different Groq Models**
   - Try mixtral-8x7b-32768 or other available models
   - Compare instruction-following capabilities

2. **Hybrid Approach**
   - Use different models for different question types
   - Route complex configs to models that handle them better

### Monitoring & Metrics

**Track these metrics during investigation:**
- **Success Rate:** % of exams without literal instruction text
- **Question Type Accuracy:** % of exams with only requested question types
- **Completion Rate:** % of exams that generate all requested questions
- **Quality Scores:** From existing ExamQualityValidator

**Success Criteria:**
- 95%+ success rate for literal instruction elimination
- Maintain current question type accuracy (100%)
- No degradation in completion rates
- No degradation in quality scores

### Temporary Mitigations

**For Users:**
1. **Recommend Presets** - they work reliably
2. **Smaller Exams** - 30-50 questions more reliable than 100
3. **Simple Configurations** - avoid complex question type mixes

**For Development:**
1. **Fallback Detection** - detect literal instruction patterns in output
2. **Retry Logic** - automatically regenerate if literal text detected  
3. **User Warnings** - inform users when using configurations prone to issues

### Notes

- This issue does not affect core authentication, quota, or PDF generation functionality
- Quality validation system catches many other issues successfully
- Dynamic prompt architecture provides good foundation for future improvements
- The problem is solvable with dedicated investigation time

---

**Last Updated:** November 13, 2025  
**Next Review:** When dedicated prompt engineering session is scheduled  
**Related Files:** `src/main/services/GroqProvider.ts`, `CLAUDE.md` (quality enhancement section)