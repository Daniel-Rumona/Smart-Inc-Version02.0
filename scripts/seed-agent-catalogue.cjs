#!/usr/bin/env node

/*
 * Seeds the Firestore Agent Registry ("agents" collection) with the three
 * platform agent definitions: business-plan, strategic-plan, pitch-coach.
 *
 * Reuses firebase-admin from functions/node_modules (same pattern as
 * migrate-firestore-collections.cjs) instead of a separate package.json.
 *
 * Usage:
 *   node scripts/seed-agent-catalogue.cjs --service-account ./new-service-account.json
 *
 * Or via environment variables (matches ai-backend's convention):
 *   FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account", ...}' node scripts/seed-agent-catalogue.cjs
 *   FIREBASE_SERVICE_ACCOUNT_B64='...' node scripts/seed-agent-catalogue.cjs
 *
 * Writes are merge writes, so running this again updates the standard
 * fields without removing unrelated fields you've added in the Console.
 */

const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')

const requireFromFunctions = createRequire(path.resolve(__dirname, '../functions/package.json'))
const admin = requireFromFunctions('firebase-admin')

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg.startsWith('--service-account=')) args.serviceAccount = arg.slice('--service-account='.length)
    else if (arg === '--service-account') args.serviceAccount = argv[++index]
    else if (arg.startsWith('--project=')) args.project = arg.slice('--project='.length)
    else if (arg === '--project') args.project = argv[++index]
  }
  return args
}

function loadServiceAccount(args) {
  if (args.serviceAccount) {
    return JSON.parse(fs.readFileSync(path.resolve(args.serviceAccount), 'utf8'))
  }

  const rawJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim()
  const rawB64 = (process.env.FIREBASE_SERVICE_ACCOUNT_B64 || '').trim()

  if (rawJson) return JSON.parse(rawJson)
  if (rawB64) return JSON.parse(Buffer.from(rawB64, 'base64').toString('utf8'))

  throw new Error(
    'Provide --service-account <path>, or set FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_B64.',
  )
}

const AGENTS = {
  'business-plan': {
    name: 'Business Plan Agent',
    description:
      'Guides an SME through a structured business or growth plan and produces an editable Word document.',
    implementationKey: 'business-plan',
    workspacePath: '/incubatee/business-plan',
    provider: 'smart-incubation',
    executionMode: 'internal',
    capabilities: [
      'Business plan drafting',
      'Growth planning',
      'Word document generation',
    ],
    supportsAssignment: true,
    supportsVoice: false,
    supportsDocuments: true,
    billable: false,
    status: 'active',
  },
  'strategic-plan': {
    name: 'Strategic Plan Agent',
    description:
      'Builds a practical multi-year strategic plan with priorities, measures, implementation ownership, and risks.',
    implementationKey: 'strategic-plan',
    workspacePath: '/incubatee/strategic-plan',
    provider: 'smart-incubation',
    executionMode: 'internal',
    capabilities: [
      'Strategic analysis',
      'Objectives and measures',
      'Implementation roadmap',
      'Word document generation',
    ],
    supportsAssignment: true,
    supportsVoice: false,
    supportsDocuments: true,
    billable: false,
    status: 'active',
  },
  'pitch-coach': {
    name: 'Pitch Preparation Agent',
    description:
      'Helps participants practise pitches and interviews and receive structured performance feedback.',
    implementationKey: 'pitchfy',
    workspacePath: '/incubatee/pitch-coach',
    provider: 'pitchfy',
    executionMode: 'external_api',
    capabilities: [
      'Brief analysis',
      'Pitch preparation',
      'Interview practice',
      'Voice practice',
      'Transcript scoring',
      'Performance analytics',
    ],
    supportsAssignment: true,
    supportsVoice: true,
    supportsDocuments: false,
    billable: true,
    status: 'active',
  },
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const serviceAccount = loadServiceAccount(args)
  const projectId = args.project || process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    })
  }

  const db = admin.firestore()
  const batch = db.batch()

  for (const [agentId, agent] of Object.entries(AGENTS)) {
    const reference = db.collection('agents').doc(agentId)
    batch.set(
      reference,
      {
        ...agent,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUid: 'seed-script',
        updatedByUid: 'seed-script',
      },
      { merge: true },
    )
  }

  await batch.commit()
  console.log(`Seeded ${Object.keys(AGENTS).length} agent definitions into project ${projectId}.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
