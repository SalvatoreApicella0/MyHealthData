import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repositoryRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const maximumTrackedFileBytes = 100 * 1024 * 1024

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: repositoryRoot })
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
}

function secretMatches() {
  const highConfidenceSecretPattern = '-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|(ghp|github_pat|xox[baprs])_[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}'
  try {
    return execFileSync('git', ['grep', '-I', '-l', '-E', '-e', highConfidenceSecretPattern, '--'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().split('\n').filter(Boolean)
  } catch (error) {
    if (error?.status === 1) return []
    throw error
  }
}

const files = trackedFiles()
const forbiddenPathPattern = /(^|\/)(?:node_modules|dist|dist-ssr|release|output|workspace-private|repository-candidate|\.codex|\.mhd-hub|\.playwright-mcp|\.derivedData|DerivedData|build|\.worktrees)(?:\/|$)|\.(?:xcarchive|ipa|mobileprovision|p12|p8|pem|pfx|key|keystore|jks|sqlite|sqlite3|db|mhdvault)$/i
const forbiddenFiles = files.filter((file) => forbiddenPathPattern.test(file)
  || /(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example')
  || file.startsWith('assets/research/')
  || /Resources\/GymDataset\/(images|videos)\//.test(file))
// `git ls-files` intentionally includes tracked paths deleted in the working
// tree. Ignore those paths for size inspection; the deletion itself is exactly
// what the next commit is meant to record.
const existingFiles = files.filter((file) => existsSync(path.join(repositoryRoot, file)))
const oversizedFiles = existingFiles.filter((file) => statSync(path.join(repositoryRoot, file)).size > maximumTrackedFileBytes)
const requiredDocuments = ['README.md', 'LICENSE', 'SECURITY.md', 'CONTRIBUTING.md']
const missingDocuments = requiredDocuments.filter((file) => !existsSync(path.join(repositoryRoot, file)))
const gitignore = readFileSync(path.join(repositoryRoot, '.gitignore'), 'utf8')
const requiredIgnoreEntries = [
  'workspace-private/',
  'repository-candidate/',
  '.mhd-hub/',
  'apps/ios/MyHealthDataiOS/build/',
  'apps/ios/MyHealthDataiOS/.derivedData/',
  '*.p12',
  '*.key',
]
const missingIgnoreEntries = requiredIgnoreEntries.filter((entry) => !gitignore.includes(entry))
const filesWithSecrets = secretMatches()

const failures = [
  forbiddenFiles.length > 0 ? `artefatti vietati tracciati: ${forbiddenFiles.join(', ')}` : null,
  oversizedFiles.length > 0 ? `file tracciati oltre 100 MiB: ${oversizedFiles.join(', ')}` : null,
  missingDocuments.length > 0 ? `documenti OSS mancanti: ${missingDocuments.join(', ')}` : null,
  missingIgnoreEntries.length > 0 ? `regole .gitignore mancanti: ${missingIgnoreEntries.join(', ')}` : null,
  filesWithSecrets.length > 0 ? `possibili segreti ad alta confidenza in: ${filesWithSecrets.join(', ')}` : null,
].filter(Boolean)

if (failures.length > 0) {
  console.error('Repository hygiene check failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(`Repository hygiene passed: ${files.length} tracked files, no forbidden artifacts or high-confidence secrets.`)
}
