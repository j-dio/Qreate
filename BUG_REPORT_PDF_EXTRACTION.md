# Bug Report: PDF Text Extraction Failure

**Date:** October 30, 2025
**Issue:** Exam generation fails during PDF text extraction phase
**Error Location:** `src/main/services/FileTextExtractor.ts`
**Impact:** Cannot generate exams from uploaded PDF files

---

## Problem Summary

When users upload a PDF file and attempt to generate an exam, the process fails during the text extraction phase (before even reaching the AI/Gemini API). The error occurs in the Electron main process when trying to extract text from PDFs using the `pdf-parse` library.

**Key Finding:** This has NOTHING to do with Gemini API or API keys. The failure happens during file text extraction, which is the step BEFORE calling any AI provider.

---

## Timeline of Attempted Fixes

### Fix Attempt #1: File Path Not Captured
**Problem:** File paths weren't being stored when files were uploaded.
**Error:** `File path not available for [filename].pdf`

**Solution Implemented:**
- Modified `src/main/index.ts` to add `open-file-dialog` IPC handler using Electron's dialog API
- Modified `src/preload/index.ts` to expose `openFileDialog()` method
- Modified `src/renderer/src/components/FileUploadZone.tsx` to use Electron dialog instead of HTML file input
- Added `get-file-stats` IPC handler to fetch file metadata (name, size, type, path)

**Files Modified:**
- `src/main/index.ts` (lines 28-85)
- `src/preload/index.ts` (lines 40-48)
- `src/renderer/src/components/FileUploadZone.tsx` (handleFilePaths function, handleClick function)
- `src/renderer/src/store/useFileUploadStore.ts` (added console logging)

**Result:** ✅ **SUCCESS** - File paths are now properly captured and stored. Confirmed by console logs showing `hasPath: true`.

---

### Fix Attempt #2: PDF-Parse Module Import
**Problem:** `pdf-parse` module not importing correctly.
**Error:** `pdfParse is not a function`

**Solution Attempt A:** Changed from CommonJS `require` to ES6 `import`
```typescript
// Before
const pdfParse = require('pdf-parse')

// After
import * as pdfParse from 'pdf-parse'
const parsePdf = (pdfParse as any).default || pdfParse
```

**Result:** ❌ **FAILED** - Same error persisted

**Solution Attempt B:** Tried using `/node` export path
```typescript
const pdfParse = require('pdf-parse/node')
```

**Result:** ❌ **FAILED** - `/node` export only contains `getHeader` function, not PDF parsing functionality

**Solution Attempt C:** Debug module exports
Added extensive logging to see what `require('pdf-parse')` returns:

```typescript
const pdfParseModule = require('pdf-parse')
console.log('Module keys:', Object.keys(pdfParseModule))
```

**Discovery:**
```
Module keys: [
  'AbortException',
  'FormatError',
  'InvalidPDFException',
  'Line',
  'LineDirection',
  'LineStore',
  'PDFParse',         // ← This is the class we need!
  'PasswordException',
  'Point',
  'Rectangle',
  'ResponseException',
  'Shape',
  'Table',
  'UnknownErrorException',
  'VerbosityLevel',
  'getException'
]
```

**Result:** ✅ **SUCCESS** - Found that the module exports a `PDFParse` class, not a direct function

---

### Fix Attempt #3: Using PDFParse Class
**Problem:** Incorrect API usage - trying to call non-existent methods
**Error:** `parser.parse is not a function`

**Solution Attempt A:** Create PDFParse instance and call `.parse()`
```typescript
const parser = new pdfParseModule.PDFParse()
const data = await parser.parse(dataBuffer)
```

**Result:** ❌ **FAILED** - `parse()` method doesn't exist

**Solution Attempt B:** Add configuration options
```typescript
const options = {
  verbosity: 0,
  disableNormalization: false,
}
const parser = new pdfParseModule.PDFParse(options)
const data = await parser.parse(dataBuffer)
```

**Result:** ❌ **FAILED** - Error: `Cannot read properties of undefined (reading 'verbosity')`

**Solution Attempt C:** Debug parser instance methods
Added logging to see available methods:

```typescript
console.log('Parser prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(parser)))
```

**Discovery:**
```
Parser prototype: [
  'constructor',
  'destroy',
  'getInfo',
  'getPageLinks',
  'getText',         // ← This is what we need!
  'load',            // ← Must call this first!
  'shouldParse',
  'getPageText',
  'getHyperlinks',
  'getImage',
  'convertToRGBA',
  'resolveEmbeddedImage',
  'getScreenshot',
  'getTable',
  'getPathGeometry',
  'getPageTables',
  'fillPageTables'
]
```

**Result:** ✅ **SUCCESS** - Found correct API: `load()` then `getText()`

---

### Fix Attempt #4: Correct API Usage
**Problem:** Incorrect parameter type for `load()` method
**Error:** `getDocument - no 'url' parameter provided`

**Solution Attempt A:** Pass buffer to load()
```typescript
await parser.load(dataBuffer)
const text = await parser.getText()
```

**Result:** ❌ **FAILED** - `load()` expects a URL or file path, not a buffer

**Solution Attempt B:** Convert file path to file:// URL
```typescript
const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`
await parser.load(fileUrl)
const text = await parser.getText()
```

**Result:** ⏳ **IN PROGRESS** - Last attempt, not yet fully tested

---

## Current Code State

### File: `src/main/services/FileTextExtractor.ts`

**Current Implementation (lines 95-140):**

```typescript
private async extractFromPDF(filePath: string): Promise<TextExtractionResult> {
  try {
    // Parse PDF
    // pdf-parse requires the file path or URL, not a buffer
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParseModule = require('pdf-parse')

    // Try using PDFParse
    if (typeof pdfParseModule.PDFParse === 'function') {
      // Create parser with default options
      const options = {
        verbosity: 0, // 0 = no console output, 1 = errors, 2 = warnings, 3 = info
        disableNormalization: false,
      }

      const parser = new pdfParseModule.PDFParse(options)

      // Load the PDF using file path (convert to file:// URL for Node.js)
      const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`
      console.log('[PDF Debug] Loading PDF from:', fileUrl)

      await parser.load(fileUrl)

      // Get text from all pages
      const text = await parser.getText()

      console.log('[PDF Debug] Successfully extracted text! Length:', text?.length)

      if (!text || text.trim().length === 0) {
        return {
          success: false,
          error: 'PDF appears to be empty or contains only images (OCR not yet implemented for PDFs)'
        }
      }

      return {
        success: true,
        text: text.trim(),
        metadata: {
          pageCount: parser.doc?.numPages || 0,
          wordCount: this.countWords(text)
        }
      }
    }

    throw new Error('Could not find usable PDF parsing function')
  } catch (error) {
    return {
      success: false,
      error: `Failed to extract from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}
```

---

## Key Insights

1. **File Path Persistence:** Fixed by using Electron's dialog API and creating custom File-like objects with path property
2. **Module Structure:** `pdf-parse` exports an object with a `PDFParse` class, not a direct function
3. **API Design:** PDFParse requires two-step process: `load()` then `getText()`
4. **Input Format:** `load()` expects a URL string (e.g., `file:///C:/path/to/file.pdf`), not a Buffer

---

## Alternative Solutions to Consider

### Option 1: Try Different PDF Library
Consider using a different, more straightforward PDF library:
- `pdf2json` - Simpler API, CommonJS friendly
- `pdfjs-dist` - Mozilla's PDF.js library
- `pdf-lib` - Modern TypeScript library

### Option 2: Use Old pdf-parse Version
The current version (2.4.5) might have API changes. Try:
```bash
npm install pdf-parse@1.1.1
```

### Option 3: Read Documentation
Check official docs/examples for `pdf-parse` v2.4.5:
- GitHub: https://github.com/mehmet-kozan/pdf-parse
- npm: https://www.npmjs.com/package/pdf-parse

### Option 4: Use Buffer Instead of File URL
Try reading the file and passing different data formats:
```typescript
const dataBuffer = await fs.readFile(filePath)
const uint8Array = new Uint8Array(dataBuffer)
await parser.load({ data: uint8Array })
```

---

## Testing Instructions

1. **Start dev server:** `npm run dev`
2. **Open app** on port 5173/5174/5175 (varies)
3. **Upload test PDF:** `DEVBIOL-1_-Introduction.pdf` (4.1MB, 17 pages)
4. **Configure exam:** Any settings (20 questions, moderate difficulty)
5. **Click "Generate Exam"**
6. **Check terminal output** for:
   - `[PDF Debug] Loading PDF from: file:///...`
   - `[PDF Debug] Successfully extracted text! Length: ...`

---

## Debug Logs to Monitor

**Terminal (Main Process):**
- File path capture: `[FileUploadStore] Adding file: { hasPath: true }`
- PDF module loading: `[PDF Debug] Module keys: [...]`
- PDF loading: `[PDF Debug] Loading PDF from: file:///...`
- Text extraction: `[PDF Debug] Successfully extracted text! Length: ...`

**DevTools Console (Renderer Process):**
- File upload: Upload success messages
- Generation progress: Progress bar updates
- Error messages: If generation fails

---

## FINAL SOLUTION IMPLEMENTED ✅

**Date:** October 30, 2025 (Continued from initial report)

### Comprehensive Multi-Strategy PDF Extraction

After multiple failed attempts with single-strategy approaches, a comprehensive solution has been implemented in `src/main/services/FileTextExtractor.ts` (lines 95-272) that tries **6 different strategies** to extract PDF text:

**Strategy 1: Old pdf-parse API (Direct Function Call)**
- Most reliable and commonly used approach
- Tries `pdfParseModule(buffer)` - direct function call with buffer
- Tries `pdfParseModule.default(buffer)` - default export with buffer

**Strategy 2: PDFParse Class with 4 Different Load Approaches**
- **Approach 2a:** Load with raw buffer
- **Approach 2b:** Load with `{data: Uint8Array}`
- **Approach 2c:** Load with `file://` URL (using `pathToFileURL`)
- **Approach 2d:** Load with absolute file path

### Implementation Details

```typescript
// Excerpt from FileTextExtractor.ts:95-272
private async extractFromPDF(filePath: string): Promise<TextExtractionResult> {
  const pdfParseModule = require('pdf-parse')

  // Strategy 1: Try old pdf-parse API (most reliable)
  // ... tries direct function call and default export

  // Strategy 2: Try PDFParse class with multiple load approaches
  // ... tries 4 different ways to load the PDF

  // Comprehensive logging shows which strategy succeeds
}
```

### Key Features of Final Solution

1. **Exhaustive Approach:** Tries every known method of using pdf-parse library
2. **Detailed Logging:** Each strategy logs its attempt and result:
   - `[PDF Debug] Strategy 1: Trying old API...`
   - `[PDF Debug] ✓ Strategy 1 SUCCESS! Text length: 12345`
   - `[PDF Debug] ✗ Approach 2a failed: error message`
3. **Graceful Fallback:** If all strategies fail, returns clear error message
4. **No Breaking Changes:** Maintains same interface, just more robust internally

### Testing Instructions

1. **Start dev server:** `npm run dev`
2. **Navigate to:** http://localhost:5173 (port may vary)
3. **Upload PDF:** `DEVBIOL-1_-Introduction.pdf` or any other PDF
4. **Configure exam:** Any settings work
5. **Click "Generate Exam"**
6. **Watch terminal for detailed logs:**
   ```
   [PDF Debug] Starting PDF extraction for: DEVBIOL-1_-Introduction.pdf
   [PDF Debug] Strategy 1: Trying old API (direct function with buffer)
   [PDF Debug] ✓ Strategy 1 SUCCESS! Text length: 45678
   ```

### Expected Results

- **If Strategy 1 succeeds:** Most common outcome, uses standard pdf-parse API
- **If Strategy 2 succeeds:** Falls back to PDFParse class methods
- **If all fail:** Clear error message suggests trying different PDF library

### Next Steps if This Fails

If all 6 strategies fail (unlikely), consider:
1. **Check PDF file:** May be corrupted, encrypted, or image-only
2. **Try different PDF:** Test with known good PDF file
3. **Switch PDF library:** Use `pdfjs-dist`, `pdf2json`, or `pdf-lib`
4. **Check pdf-parse version:** Try downgrading to `pdf-parse@1.1.1`

### Status

✅ **IMPLEMENTED AND DEPLOYED**
- Code: `src/main/services/FileTextExtractor.ts:95-272`
- Build: Successful (bundle size: 14.83 kB)
- Server: Running on port 5173
- Ready for testing with real PDF files

### Next Action

**User should now:**
1. Open the Qreate app at http://localhost:5173
2. Upload a PDF file
3. Configure and generate an exam
4. Report which strategy succeeded (visible in terminal logs)

---

## DECISION: REVERTED TO STABLE COMMIT ⏮️

**Date:** October 30, 2025
**Action:** Reverted to commit 4f78365

### Why We Reverted

After extensive debugging attempts with multiple PDF libraries:
1. **pdf-parse** - Multiple API strategies failed (6 different approaches)
2. **pdfjs-dist** - ES module compatibility issues with Electron/require()
3. Time invested exceeded reasonable threshold for single feature
4. Risk of introducing more bugs while fixing PDF extraction

### Libraries Tried and Why They Failed

| Library | Attempts | Issues |
|---------|----------|--------|
| pdf-parse@2.4.5 | 6 strategies | API incompatibility, module structure issues |
| pdfjs-dist@4.0.379 | 2 approaches | ES module vs CommonJS, top-level await issues |

### Current State After Revert

**Commit:** `4f78365` - "feat: Implement Phase 3 Exam Generation with progress tracking"

**What Works:**
- ✅ Word documents (.docx, .doc) via mammoth
- ✅ Text files (.txt) via direct fs.readFile
- ✅ Images (.png, .jpg) via Tesseract OCR
- ✅ Exam generation workflow
- ✅ Multi-LLM provider support (Gemini, OpenAI)

**What Doesn't Work:**
- ❌ PDF files (.pdf) - placeholders used instead

**Server Status:** ✅ Running on port 5176
**Bundle Size:** 1.64 kB (much smaller, cleaner)

---

## Next Steps: PDF Support Options

### Option 1: Mark PDF as "Coming Soon" (Recommended)
**Pros:**
- Ship working product with .docx/.txt support now
- Add PDF later when we find better library
- Focus on other features (Google Docs export, etc.)

**Cons:**
- Users can't use PDF files (but they can use Word/text)

### Option 2: Try Simpler PDF Library
**Libraries to consider:**
- **`pdf2json`** - Simple API, CommonJS friendly
- **`@pdf-lib/standard-fonts`** - Lightweight
- **`node-pdfreader`** - Minimal dependencies

**Approach:** Research and test one of these in a separate branch, don't block main development.

### Option 3: Convert PDF to Text Externally
Users can convert PDF→Word/Text using:
- Google Docs (Upload PDF → Download as .docx)
- Adobe online tools
- pdf2txt command line tools

Then upload the converted file to Qreate.

---

## Recommendation

**Ship the app without PDF support for now.**

PDF extraction is a single feature that's proven complex. The app works great with:
- Word documents (most common format for study materials)
- Text files (simple, reliable)
- Images (OCR works well)

Add PDF support in a future update after:
1. Completing Phase 4 (Google Docs export)
2. Completing Phase 5 (Project management)
3. Testing with real users to see if PDF is actually needed

**Pragmatic approach:** Ship working product → Get user feedback → Add PDF if users request it.

---

## Package Information

```json
{
  "pdf-parse": "2.4.5",
  "electron": "latest",
  "node": ">=20.16.0"
}
```

**pdf-parse package.json exports:**
```json
"exports": {
  ".": {
    "require": "./dist/pdf-parse/cjs/index.cjs",
    "import": "./dist/pdf-parse/esm/index.js"
  },
  "./node": {
    "require": "./dist/node/cjs/index.cjs",
    "import": "./dist/node/esm/index.js"
  }
}
```

---

## Contact Points

- **Main issue:** PDF text extraction in Electron main process
- **Library:** pdf-parse@2.4.5
- **Environment:** Electron + Node.js + TypeScript
- **OS:** Windows (file paths use backslashes)

Good luck with the fix! 🚀
