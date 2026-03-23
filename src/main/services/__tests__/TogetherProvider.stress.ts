/**
 * TogetherProvider Stress Test — manual run only, not part of CI
 *
 * Runs generateExam N times and reports compliance rates for:
 *   - Pass 1: type allowlist (no disallowed types in plan)
 *   - Pass 2: per-type question count matches plan
 *   - Pass 2: T/F true/false answer distribution matches targets
 *   - Pass 2: no phantom section headers for absent types
 *
 * Usage:
 *   STRESS_RUNS=10 npx tsx src/main/services/__tests__/TogetherProvider.stress.ts
 *
 * Requires TOGETHER_API_KEY (and optionally GROQ_API_KEY) in .env.local
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { TogetherProvider, validatePass2OutputStandalone } from '../TogetherProvider'
import type { ExamGenerationConfig } from '../TogetherProvider'
import type { TopicPlan } from '../../../shared/types/exam'

// Load environment from project root .env.local
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env.local') })

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RUN_COUNT = parseInt(process.env.STRESS_RUNS ?? '5', 10)

const SAMPLE_CONFIG: ExamGenerationConfig = {
  questionTypes: {
    multipleChoice: true,
    trueFalse: true,
    fillInTheBlanks: true,
    shortAnswer: true,
  },
  difficultyDistribution: {
    veryEasy: 3,
    easy: 7,
    moderate: 10,
    hard: 7,
    veryHard: 3,
  },
  totalQuestions: 30,
}

// Short but representative sample source text for repeatable testing
const SAMPLE_SOURCE_TEXT = `
=== SOURCE 1: Cell Biology Basics ===
Cells are the fundamental units of life. There are two main categories: prokaryotic cells, which lack
a membrane-bound nucleus, and eukaryotic cells, which contain a nucleus enclosed by a membrane.
Prokaryotes include bacteria and archaea. Eukaryotes include plants, animals, fungi, and protists.

The cell membrane is a phospholipid bilayer that controls the movement of substances in and out of
the cell. It is selectively permeable. Mitochondria are organelles found in eukaryotic cells that
produce ATP through cellular respiration. The mitochondria have their own DNA. The nucleus contains
the cell's genetic material (DNA) organized into chromosomes. Ribosomes are responsible for protein
synthesis. The endoplasmic reticulum (ER) is a network of membranes; rough ER has ribosomes and
synthesizes proteins, smooth ER lacks ribosomes and synthesizes lipids.

The Golgi apparatus modifies, packages, and ships proteins. Lysosomes contain digestive enzymes.
Vacuoles store water, food, or waste. In plant cells, the cell wall provides additional structural
support and is made of cellulose. Chloroplasts are organelles in plant cells that carry out photosynthesis,
converting light energy into chemical energy (glucose). They contain chlorophyll, the green pigment.

=== SOURCE 2: Genetics Fundamentals ===
DNA (deoxyribonucleic acid) carries genetic information. It is a double helix composed of nucleotides.
Each nucleotide contains a sugar (deoxyribose), a phosphate group, and one of four nitrogenous bases:
adenine (A), thymine (T), guanine (G), and cytosine (C). Base pairing rules: A pairs with T, G pairs with C.

RNA (ribonucleic acid) is single-stranded. In mRNA, uracil (U) replaces thymine. Transcription is
the process of copying DNA into mRNA in the nucleus. Translation is the process of synthesizing a
protein from mRNA at the ribosome. The genetic code is a triplet code; each codon (3 bases) specifies
one amino acid.

Genes are segments of DNA that encode proteins. Alleles are different versions of the same gene.
Dominant alleles mask the expression of recessive alleles. Homozygous organisms carry two identical
alleles for a trait; heterozygous carry two different alleles. Genotype refers to the genetic makeup;
phenotype refers to the observable traits. Mutations are changes in DNA sequence. Point mutations
change a single nucleotide. Chromosomal mutations affect large chromosomal segments.
`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunResult {
  run: number
  success: boolean
  durationMs: number
  pass1TypeCompliance: boolean
  pass2McCount: boolean
  pass2TfCount: boolean
  pass2FitbCount: boolean
  pass2SaCount: boolean
  pass2TfVariance: boolean
  pass2NoPhantoms: boolean
  violations: string[]
  error?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function analyzeOutput(
  content: string,
  plan: TopicPlan,
  run: number,
  durationMs: number
): RunResult {
  const tfCount = plan.concepts.filter(c => c.type === 'trueFalse').length
  const targetFalseCount = Math.floor(tfCount / 2)
  const targetTrueCount = tfCount - targetFalseCount

  const result = validatePass2OutputStandalone(content, plan, targetTrueCount, targetFalseCount)

  // Categorize violations by type
  const hasViolation = (pattern: RegExp) => result.violations.some(v => pattern.test(v))

  const mcViolation = hasViolation(/multipleChoice/)
  const tfViolation = hasViolation(/trueFalse.*count/i)
  const fitbViolation = hasViolation(/fillInTheBlanks/)
  const saViolation = hasViolation(/shortAnswer/)
  const tfVarianceViolation = hasViolation(/T\/F variance/i)
  const phantomViolation = hasViolation(/Phantom section/i)

  // Pass 1 type compliance: check all concept types are in config
  const enabledTypes = new Set(
    Object.entries(SAMPLE_CONFIG.questionTypes)
      .filter(([, v]) => v)
      .map(([k]) => k)
  )
  const pass1TypeCompliance = plan.concepts.every(c => enabledTypes.has(c.type))

  return {
    run,
    success: result.valid,
    durationMs,
    pass1TypeCompliance,
    pass2McCount: !mcViolation,
    pass2TfCount: !tfViolation,
    pass2FitbCount: !fitbViolation,
    pass2SaCount: !saViolation,
    pass2TfVariance: !tfVarianceViolation,
    pass2NoPhantoms: !phantomViolation,
    violations: result.violations,
  }
}

function complianceRate(results: RunResult[], field: keyof RunResult): string {
  const passing = results.filter(r => r[field] === true).length
  return `${passing}/${results.length} (${((passing / results.length) * 100).toFixed(0)}%)`
}

function printSummary(results: RunResult[]): void {
  console.log('\n=== STRESS TEST SUMMARY ===\n')

  const tableData = results.map(r => ({
    Run: r.run,
    Status: r.success ? 'PASS' : 'FAIL',
    'Duration(ms)': r.durationMs,
    'P1 Types': r.pass1TypeCompliance ? '✓' : '✗',
    'P2 MC#': r.pass2McCount ? '✓' : '✗',
    'P2 TF#': r.pass2TfCount ? '✓' : '✗',
    'P2 FitB#': r.pass2FitbCount ? '✓' : '✗',
    'P2 SA#': r.pass2SaCount ? '✓' : '✗',
    'P2 TF Var': r.pass2TfVariance ? '✓' : '✗',
    'P2 No Ghost': r.pass2NoPhantoms ? '✓' : '✗',
  }))

  console.table(tableData)

  console.log('\n=== COMPLIANCE RATES ===\n')
  console.log(`  Overall pass:          ${complianceRate(results, 'success')}`)
  console.log(`  Pass 1 type allowlist: ${complianceRate(results, 'pass1TypeCompliance')}`)
  console.log(`  Pass 2 MC count:       ${complianceRate(results, 'pass2McCount')}`)
  console.log(`  Pass 2 T/F count:      ${complianceRate(results, 'pass2TfCount')}`)
  console.log(`  Pass 2 FitB count:     ${complianceRate(results, 'pass2FitbCount')}`)
  console.log(`  Pass 2 SA count:       ${complianceRate(results, 'pass2SaCount')}`)
  console.log(`  Pass 2 T/F variance:   ${complianceRate(results, 'pass2TfVariance')}`)
  console.log(`  Pass 2 no phantoms:    ${complianceRate(results, 'pass2NoPhantoms')}`)

  const failed = results.filter(r => !r.success)
  if (failed.length > 0) {
    console.log('\n=== VIOLATIONS ===\n')
    for (const r of failed) {
      console.log(`  Run ${r.run}:`)
      for (const v of r.violations) {
        console.log(`    - ${v}`)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runStress(): Promise<void> {
  const togetherKey = process.env.TOGETHER_API_KEY
  const groqKey = process.env.GROQ_API_KEY

  if (!togetherKey) {
    console.error('ERROR: TOGETHER_API_KEY not set. Load .env.local or set it in the environment.')
    process.exit(1)
  }

  console.log(`\n=== TogetherProvider Stress Test ===`)
  console.log(`Runs: ${RUN_COUNT}`)
  console.log(`Questions per run: ${SAMPLE_CONFIG.totalQuestions}`)
  console.log(`Types: ${Object.entries(SAMPLE_CONFIG.questionTypes).filter(([, v]) => v).map(([k]) => k).join(', ')}`)
  console.log()

  const provider = new TogetherProvider(togetherKey, groqKey)
  const results: RunResult[] = []

  for (let i = 1; i <= RUN_COUNT; i++) {
    console.log(`[Run ${i}/${RUN_COUNT}] Generating...`)
    const start = Date.now()

    try {
      const { content } = await provider.generateExam(SAMPLE_CONFIG, SAMPLE_SOURCE_TEXT)
      const plan = provider.getLastPlan()
      const durationMs = Date.now() - start

      if (!plan) {
        results.push({
          run: i,
          success: false,
          durationMs,
          pass1TypeCompliance: false,
          pass2McCount: false,
          pass2TfCount: false,
          pass2FitbCount: false,
          pass2SaCount: false,
          pass2TfVariance: false,
          pass2NoPhantoms: false,
          violations: ['getLastPlan() returned null — plan not captured'],
        })
        continue
      }

      const result = analyzeOutput(content, plan, i, durationMs)
      results.push(result)
      console.log(
        `[Run ${i}/${RUN_COUNT}] ${result.success ? 'PASS' : `FAIL (${result.violations.length} violation(s))`} — ${durationMs}ms`
      )
    } catch (err: any) {
      const durationMs = Date.now() - start
      console.log(`[Run ${i}/${RUN_COUNT}] ERROR — ${err.message}`)
      results.push({
        run: i,
        success: false,
        durationMs,
        pass1TypeCompliance: false,
        pass2McCount: false,
        pass2TfCount: false,
        pass2FitbCount: false,
        pass2SaCount: false,
        pass2TfVariance: false,
        pass2NoPhantoms: false,
        violations: [err.message],
        error: err.message,
      })
    }
  }

  printSummary(results)
}

runStress().catch(err => {
  console.error('Stress test failed:', err)
  process.exit(1)
})
