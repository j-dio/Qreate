# Groq Stress Test Guide

## Testing Platform
Go to: **https://console.groq.com/playground**

## Models to Test
1. **llama-3.1-70b-versatile** (RECOMMENDED - best for complex tasks)
2. **llama-3.1-8b-instant** (faster but less powerful)
3. **mixtral-8x7b-32768** (good balance)

---

## Test Scenarios

### Test 1: Small Exam (30 items) - Baseline Test
**This should work perfectly. If it fails, Groq is not suitable.**

### Test 2: Medium Exam (50 items) - Standard Use Case
**Most users will create 50-item exams. Critical test.**

### Test 3: Large Exam (100 items) - Heavy Use Case
**Power users. This is where Gemini starts failing.**

### Test 4: Maximum Exam (200 items) - Stress Test
**Absolute limit. If this works, Groq is amazing.**

---

## Exact Prompt Template

**Copy this and replace the placeholders:**

```
You are an expert exam creator. Generate an educational exam based on the provided study material.

**CRITICAL INSTRUCTIONS:**
1. Generate ONLY the exam content - no introductions, explanations, or suggestions
2. Follow the format below EXACTLY - character for character
3. Use ONLY information from the provided study material
4. ALL questions must be complete sentences with proper formatting
5. For Multiple Choice: ALWAYS include exactly 4 options (A, B, C, D) on separate lines
6. For True/False: Label as "True/False" section, each question is a complete statement
7. Ensure questions are clear, unambiguous, and academically rigorous

**EXACT OUTPUT FORMAT (follow this template precisely):**

General Topic: [Extract the main topic from the study material]

----Exam Content----

Multiple Choice:

1. [Question text here?]
   A. [First option]
   B. [Second option]
   C. [Third option]
   D. [Fourth option]

2. [Next question text here?]
   A. [First option]
   B. [Second option]
   C. [Third option]
   D. [Fourth option]

True/False:

3. [Statement that can be true or false.]

4. [Another statement that can be true or false.]

Fill in the Blanks:

5. [Question text with _____ representing the blank.]

[Continue for all question types...]

[PAGE BREAK]

----Answer Key----

1. A
2. C
3. True
4. False
5. [correct word or phrase]
[Continue for all questions...]

**FORMATTING RULES:**
- Number questions sequentially (1, 2, 3, etc.) across ALL types
- Group questions by type (Multiple Choice first, then True/False, etc.)
- Each multiple choice question MUST have exactly 4 options labeled A, B, C, D
- Each option on its own line, indented with 3 spaces
- One blank line between questions
- Answer key: Just the number and answer (e.g., "1. A", not "1. A. First option")

**QUESTION TYPES & QUANTITIES:**
[REPLACE WITH TEST SCENARIO BELOW]

**DIFFICULTY DISTRIBUTION:**
[REPLACE WITH TEST SCENARIO BELOW]

**STUDY MATERIAL:**
[PASTE YOUR STUDY MATERIAL HERE]

**OUTPUT:**
Generate the exam now following the EXACT format above. No introductory text, no explanations, ONLY the formatted exam.
```

---

## Test Scenario Configurations

### TEST 1: 30 Items (Where Gemini Barely Works)

**Question Types:**
```
  - Multiple choice: 15 question(s)
  - True false: 10 question(s)
  - Fill in the blanks: 5 question(s)
```

**Difficulty Distribution:**
```
  - Very easy: 5 question(s)
  - Easy: 7 question(s)
  - Moderate: 10 question(s)
  - Hard: 6 question(s)
  - Very hard: 2 question(s)
```

**Total Questions:** 30

---

### TEST 2: 50 Items (Standard Exam)

**Question Types:**
```
  - Multiple choice: 25 question(s)
  - True false: 15 question(s)
  - Fill in the blanks: 10 question(s)
```

**Difficulty Distribution:**
```
  - Very easy: 10 question(s)
  - Easy: 10 question(s)
  - Moderate: 15 question(s)
  - Hard: 10 question(s)
  - Very hard: 5 question(s)
```

**Total Questions:** 50

---

### TEST 3: 100 Items (Where Gemini Fails)

**Question Types:**
```
  - Multiple choice: 50 question(s)
  - True false: 30 question(s)
  - Fill in the blanks: 15 question(s)
  - Short answer: 5 question(s)
```

**Difficulty Distribution:**
```
  - Very easy: 20 question(s)
  - Easy: 20 question(s)
  - Moderate: 30 question(s)
  - Hard: 20 question(s)
  - Very hard: 10 question(s)
```

**Total Questions:** 100

---

### TEST 4: 200 Items (Maximum Stress Test)

**Question Types:**
```
  - Multiple choice: 100 question(s)
  - True false: 50 question(s)
  - Fill in the blanks: 30 question(s)
  - Short answer: 15 question(s)
  - Identification: 5 question(s)
```

**Difficulty Distribution:**
```
  - Very easy: 40 question(s)
  - Easy: 40 question(s)
  - Moderate: 60 question(s)
  - Hard: 40 question(s)
  - Very hard: 20 question(s)
```

**Total Questions:** 200

---

## Sample Study Material

**Use this if you don't have your own test file:**

```
Introduction to Photosynthesis

Photosynthesis is the process by which plants convert light energy into chemical energy. This process takes place primarily in the chloroplasts of plant cells, specifically in structures called thylakoids.

The Chemical Equation
The overall equation for photosynthesis is:
6CO2 + 6H2O + light energy → C6H12O6 + 6O2

This means that six molecules of carbon dioxide and six molecules of water, in the presence of light energy, produce one molecule of glucose and six molecules of oxygen.

Light-Dependent Reactions
The light-dependent reactions occur in the thylakoid membranes and require light energy. During these reactions:
1. Chlorophyll absorbs light energy
2. Water molecules are split (photolysis)
3. Oxygen is released as a byproduct
4. ATP and NADPH are produced

The light-dependent reactions convert light energy into chemical energy stored in ATP and NADPH molecules. These energy carriers are then used in the light-independent reactions.

Light-Independent Reactions (Calvin Cycle)
The Calvin Cycle takes place in the stroma of chloroplasts and does not directly require light. This cycle:
1. Uses ATP and NADPH from light-dependent reactions
2. Fixes carbon dioxide into organic molecules
3. Produces glucose (C6H12O6)

The Calvin Cycle consists of three main stages:
- Carbon fixation: CO2 is attached to RuBP (ribulose bisphosphate)
- Reduction: 3-PGA is reduced to G3P using ATP and NADPH
- Regeneration: RuBP is regenerated to continue the cycle

Factors Affecting Photosynthesis
Several factors can limit the rate of photosynthesis:

1. Light Intensity: Increased light generally increases photosynthesis rate until saturation point
2. Carbon Dioxide Concentration: Higher CO2 levels can increase the rate up to a certain point
3. Temperature: Optimal temperature is around 25-35°C; too high or low reduces enzyme activity
4. Water Availability: Lack of water can close stomata, limiting CO2 intake

Chloroplast Structure
Chloroplasts have a double membrane structure:
- Outer membrane: Permeable to small molecules
- Inner membrane: Selectively permeable
- Thylakoids: Disc-shaped structures containing chlorophyll
- Stroma: Fluid-filled space containing enzymes for the Calvin Cycle
- Grana: Stacks of thylakoids

Pigments and Light Absorption
Chlorophyll is the primary pigment, but other pigments also play roles:
- Chlorophyll a: Absorbs blue-violet and red light (primary pigment)
- Chlorophyll b: Absorbs blue and orange light (accessory pigment)
- Carotenoids: Absorb blue-green light, appear yellow-orange

Different pigments absorb different wavelengths of light, which is why plants appear green—they reflect green light while absorbing other wavelengths.

Importance of Photosynthesis
Photosynthesis is crucial for life on Earth because it:
1. Produces oxygen for aerobic respiration
2. Converts light energy into chemical energy
3. Forms the base of most food chains
4. Helps regulate atmospheric CO2 levels
5. Supports the carbon cycle

Environmental Significance
Photosynthesis plays a vital role in:
- Carbon sequestration (removing CO2 from atmosphere)
- Oxygen production for the biosphere
- Climate regulation
- Supporting biodiversity through food chains

C3, C4, and CAM Plants
Plants have evolved different photosynthetic pathways:

C3 Plants (most common):
- Use only Calvin Cycle
- Examples: rice, wheat, soybeans
- Less efficient in hot, dry conditions

C4 Plants:
- Separate CO2 fixation from Calvin Cycle
- More efficient in hot climates
- Examples: corn, sugarcane, sorghum

CAM Plants:
- Open stomata at night to reduce water loss
- Store CO2 as malate
- Examples: cacti, succulents, pineapple

Adaptations for Photosynthesis
Leaves are specialized for photosynthesis:
- Large surface area for light absorption
- Thin structure for gas diffusion
- Stomata for gas exchange
- Vascular bundles for transport
- Palisade mesophyll cells packed with chloroplasts

The arrangement of leaves on a plant (phyllotaxy) often maximizes light exposure while minimizing shading of lower leaves.

Artificial Photosynthesis
Scientists are working to mimic photosynthesis to:
- Create renewable fuels
- Capture and store solar energy
- Reduce atmospheric CO2
- Develop sustainable energy sources

Understanding photosynthesis is essential for improving crop yields, addressing climate change, and developing biotechnology applications.
```

---

## Success Validation Checklist

For each test, check if the output has:

### ✅ Format Requirements
- [ ] **Starts with "General Topic:"**
- [ ] **Has "----Exam Content----" section**
- [ ] **Has "[PAGE BREAK]" separator**
- [ ] **Has "----Answer Key----" section**
- [ ] **No introductory text** (e.g., "Here's your exam...", "I've generated...")
- [ ] **No concluding remarks** (e.g., "Good luck!", "Let me know if...")

### ✅ Multiple Choice Questions
- [ ] **Exactly 4 options (A, B, C, D)** for EVERY multiple choice question
- [ ] **Options are on separate lines**
- [ ] **Options are indented with spaces**
- [ ] **Question text ends with "?"**
- [ ] **All options are complete and distinct**

### ✅ Question Counts
- [ ] **Correct number of Multiple Choice questions**
- [ ] **Correct number of True/False questions**
- [ ] **Correct number of Fill in the Blanks questions**
- [ ] **Total matches requested quantity** (30, 50, 100, or 200)

### ✅ Answer Key
- [ ] **Answer key is present**
- [ ] **Answer key is on separate page/section**
- [ ] **Every question has an answer**
- [ ] **Answers are numbered sequentially (1, 2, 3...)**
- [ ] **Answers match question count**
- [ ] **Multiple choice answers are just letters** (e.g., "1. A", not "1. A. First option")

### ✅ Question Numbering
- [ ] **Sequential numbering across all types** (1, 2, 3... not restarting)
- [ ] **Questions grouped by type**
- [ ] **No duplicate numbers**

---

## Comparison Table

After testing, fill this out:

| Model | 30 Items | 50 Items | 100 Items | 200 Items | Notes |
|-------|----------|----------|-----------|-----------|-------|
| **Gemini 2.5 Flash** | ❌ Inconsistent | ❌ Often fails | ❌ Always fails | ❌ Always fails | Missing answer keys, incomplete |
| **ChatGPT (GPT-4o-mini)** | ✅ Perfect | ✅ Perfect | ✅ Perfect | ? Not tested | Known working baseline |
| **Groq Llama 3.1 70B** | ? | ? | ? | ? | Test this! |
| **Groq Llama 3.1 8B** | ? | ? | ? | ? | Test this! |
| **Groq Mixtral 8x7B** | ? | ? | ? | ? | Test this! |

---

## Critical Failure Patterns to Watch For

Based on Gemini's problems, check if Groq has these issues:

### 1. **Missing Answer Key**
- Answer key section is completely absent
- Only shows exam content, no answers

### 2. **Incomplete Generation**
- Cuts off mid-question
- Stops before reaching requested quantity
- Example: Asked for 100, only generated 47

### 3. **Wrong Option Count**
- Multiple choice with only 2-3 options
- Missing option D
- Not following A, B, C, D format

### 4. **Format Violations**
- Adds introductory text ("Here's your exam...")
- Adds explanations or suggestions
- Doesn't follow template structure

### 5. **Wrong Question Count**
- Generates more or fewer questions than requested
- Example: Asked for 50, got 43

---

## Recommended Testing Order

1. **Start with Test 1 (30 items) on Llama 3.1 70B**
   - If this fails → Groq is not suitable, move to Plan B
   - If this works → Continue to Test 2

2. **Test 2 (50 items) on Llama 3.1 70B**
   - This is the most important test (standard use case)
   - If this works consistently → Groq is viable!

3. **Test 3 (100 items) on Llama 3.1 70B**
   - Where Gemini fails
   - If Groq succeeds here → Major win

4. **Test 4 (200 items) - Optional**
   - Only if previous tests succeed
   - This is extreme edge case

5. **Repeat with Llama 3.1 8B (faster model)**
   - Test if speed increase is worth quality trade-off

---

## Temperature Settings

Try these temperature values in Groq playground:

- **0.7** (default, balanced) - Start here
- **0.5** (more consistent) - If 0.7 is too random
- **0.3** (very deterministic) - If you want maximum consistency

Lower temperature = More consistent but potentially less creative questions

---

## Report Back

After testing, tell me:

1. **Which models worked?**
2. **Which test scenarios passed?**
3. **Any consistent failure patterns?**
4. **Quality comparison vs ChatGPT** (are questions good?)
5. **Speed** (how long did it take?)

Then we'll decide:
- ✅ Groq works → Implement it (free solution!)
- ❌ Groq fails → Plan B: Hybrid or paid ChatGPT with limits
