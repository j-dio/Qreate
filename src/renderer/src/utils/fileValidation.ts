/**
 * File Validation Utilities
 *
 * Centralized validation logic for file uploads.
 *
 * Why separate validation functions?
 * - Reusability: Can be used in multiple components
 * - Testability: Easy to unit test in isolation
 * - Maintainability: All validation rules in one place
 * - Clear error messages: User-friendly feedback
 *
 * Validation Rules (from CLAUDE.md):
 * - Max 5 files total
 * - Max 50MB per file
 * - Max 200MB total
 * - Allowed types: PDF, DOCX, DOC, TXT, PNG, JPG
 */

import { VALIDATION_RULES } from '../store/useFileUploadStore'

/**
 * Validation Result interface
 * Contains validation outcome and error message if invalid
 */
export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Format bytes to human-readable string
 *
 * Examples:
 * - formatBytes(1024) => "1 KB"
 * - formatBytes(1048576) => "1 MB"
 * - formatBytes(52428800) => "50 MB"
 *
 * Why this is useful:
 * - Users understand "50 MB" better than "52428800 bytes"
 * - Consistent formatting across the app
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Get file extension from filename
 *
 * Examples:
 * - getFileExtension("document.pdf") => "pdf"
 * - getFileExtension("report.DOCX") => "docx"
 * - getFileExtension("file.tar.gz") => "gz"
 *
 * Note: Converts to lowercase for consistent comparison
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

/**
 * Check if file type is allowed
 *
 * Validates against two criteria:
 * 1. MIME type (e.g., "application/pdf")
 * 2. File extension (e.g., ".pdf")
 *
 * Why check both?
 * - MIME type can be spoofed or incorrect
 * - Extension provides a secondary check
 * - Better security through defense in depth
 */
export function isFileTypeAllowed(file: File): ValidationResult {
  const extension = getFileExtension(file.name)
  const mimeType = file.type

  // Check if MIME type is in our allowed list
  const allowedMimeTypes = Object.keys(VALIDATION_RULES.ALLOWED_TYPES)
  const isMimeTypeAllowed = allowedMimeTypes.includes(mimeType)

  // Check if extension matches the MIME type
  let isExtensionValid = false
  if (isMimeTypeAllowed) {
    const allowedExtensions =
      VALIDATION_RULES.ALLOWED_TYPES[mimeType as keyof typeof VALIDATION_RULES.ALLOWED_TYPES]
    isExtensionValid = allowedExtensions.includes(extension as never)
  }

  // If both checks pass, file is valid
  if (isMimeTypeAllowed && isExtensionValid) {
    return { isValid: true }
  }

  // Build helpful error message
  const allowedExtensionsFlat = Object.values(VALIDATION_RULES.ALLOWED_TYPES).flat()
  return {
    isValid: false,
    error: `File type "${extension || 'unknown'}" is not supported. Allowed types: ${allowedExtensionsFlat.join(', ').toUpperCase()}`,
  }
}

/**
 * Check if file size is within limit
 *
 * Validates individual file size (max 50MB per file)
 */
export function isFileSizeValid(file: File): ValidationResult {
  if (file.size > VALIDATION_RULES.MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File "${file.name}" is too large. Maximum size is ${formatBytes(VALIDATION_RULES.MAX_FILE_SIZE)} (file is ${formatBytes(file.size)})`,
    }
  }

  return { isValid: true }
}

/**
 * Check if total size is within limit
 *
 * Validates cumulative size of all files (max 200MB total)
 *
 * Parameters:
 * - currentTotalSize: Size of already uploaded files
 * - newFiles: New files being added
 */
export function isTotalSizeValid(currentTotalSize: number, newFiles: File[]): ValidationResult {
  const newFilesSize = newFiles.reduce((sum, file) => sum + file.size, 0)
  const totalSize = currentTotalSize + newFilesSize

  if (totalSize > VALIDATION_RULES.MAX_TOTAL_SIZE) {
    return {
      isValid: false,
      error: `Total size exceeds ${formatBytes(VALIDATION_RULES.MAX_TOTAL_SIZE)}. Current: ${formatBytes(currentTotalSize)}, Adding: ${formatBytes(newFilesSize)}, Total would be: ${formatBytes(totalSize)}`,
    }
  }

  return { isValid: true }
}

/**
 * Check if we can add more files
 *
 * Validates against the maximum file count (5 files)
 */
export function canAddMoreFiles(currentCount: number, newFilesCount: number): ValidationResult {
  const totalCount = currentCount + newFilesCount

  if (totalCount > VALIDATION_RULES.MAX_FILES) {
    return {
      isValid: false,
      error: `Maximum ${VALIDATION_RULES.MAX_FILES} files allowed. You currently have ${currentCount} file(s) and are trying to add ${newFilesCount} more.`,
    }
  }

  return { isValid: true }
}

/**
 * Comprehensive file validation
 *
 * Runs ALL validation checks and returns the first error found.
 * This is the main function components should use.
 *
 * Validation order (fail-fast approach):
 * 1. Check file count limit
 * 2. Check each file's type
 * 3. Check each file's size
 * 4. Check total size limit
 *
 * Why this order?
 * - File count is cheapest to check (just a number)
 * - File type/size are quick checks on individual files
 * - Total size is calculated last after individual validations pass
 */
export function validateFiles(
  newFiles: File[],
  currentUploadedCount: number,
  currentTotalSize: number
): ValidationResult {
  // Check 1: File count
  const countCheck = canAddMoreFiles(currentUploadedCount, newFiles.length)
  if (!countCheck.isValid) return countCheck

  // Check 2: File types
  for (const file of newFiles) {
    const typeCheck = isFileTypeAllowed(file)
    if (!typeCheck.isValid) return typeCheck
  }

  // Check 3: Individual file sizes
  for (const file of newFiles) {
    const sizeCheck = isFileSizeValid(file)
    if (!sizeCheck.isValid) return sizeCheck
  }

  // Check 4: Total size
  const totalSizeCheck = isTotalSizeValid(currentTotalSize, newFiles)
  if (!totalSizeCheck.isValid) return totalSizeCheck

  // All checks passed!
  return { isValid: true }
}

/**
 * Get a user-friendly description of allowed file types
 *
 * Returns: "PDF, DOCX, DOC, TXT, PNG, JPG"
 */
export function getAllowedFileTypesDescription(): string {
  const extensions = Object.values(VALIDATION_RULES.ALLOWED_TYPES)
    .flat()
    .map(ext => ext.toUpperCase())
  return extensions.join(', ')
}

/**
 * Get validation rules summary for UI display
 *
 * Useful for showing rules to users before they upload
 */
export function getValidationRulesSummary() {
  return {
    maxFiles: VALIDATION_RULES.MAX_FILES,
    maxFileSize: formatBytes(VALIDATION_RULES.MAX_FILE_SIZE),
    maxTotalSize: formatBytes(VALIDATION_RULES.MAX_TOTAL_SIZE),
    allowedTypes: getAllowedFileTypesDescription(),
  }
}
