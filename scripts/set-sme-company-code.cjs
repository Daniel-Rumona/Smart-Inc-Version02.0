#!/usr/bin/env node

/*
 * Inspects SME (role: incubatee) users and optionally moves one into the platform
 * owner's bucket (companyCode: QTX) so the consultant marketplace can be tested.
 *
 * The marketplace is visible to an SME only when BOTH are true:
 *   1. companyCode resolves to QTX (blank counts as QTX, per resolveSmeCompanyCode)
 *   2. they are an applicant - no participants record and no applications record,
 *      which is how isApplicantWorkspaceUser resolves the workspace audience
 * The listing below reports both, so you can pick an SME that will actually see it.
 *
 * Reuses firebase-admin from functions/node_modules (same pattern as
 * seed-agent-catalogue.cjs) instead of a separate package.json.
 *
 * Usage:
 *   # read-only: show SMEs and whether each would see the marketplace
 *   node scripts/set-sme-company-code.cjs --service-account ./scripts/new-service-account.json --list
 *
 *   # dry run (default): show what would change for one SME
 *   node scripts/set-sme-company-code.cjs --service-account ./scripts/new-service-account.json --email sme@example.com
 *
 *   # write it
 *   node scripts/set-sme-company-code.cjs --service-account ./scripts/new-service-account.json --email sme@example.com --apply
 *
 *   # put it back afterwards (--code '' clears the field to null)
 *   node scripts/set-sme-company-code.cjs --service-account ./scripts/new-service-account.json --email sme@example.com --code ACME --apply
 *
 * Only ever touches the single `companyCode` field on one users document, and
 * prints the previous value so the change can be undone.
 */

const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')

const requireFromFunctions = createRequire(path.resolve(__dirname, '../functions/package.json'))
const admin = requireFromFunctions('firebase-admin')

const PLATFORM_OWNER_CODE = 'QTX'

function parseArgs(argv) {
  const args = { apply: false, list: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg.startsWith('--service-account=')) args.serviceAccount = arg.slice('--service-account='.length)
    else if (arg === '--service-account') args.serviceAccount = argv[++index]
    else if (arg.startsWith('--email=')) args.email = arg.slice('--email='.length)
    else if (arg === '--email') args.email = argv[++index]
    else if (arg.startsWith('--code=')) args.code = arg.slice('--code='.length)
    else if (arg === '--code') args.code = argv[++index]
    else if (arg === '--apply') args.apply = true
    else if (arg === '--list') args.list = true
  }
  return args
}

function loadServiceAccount(args) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8'))
  }
  if (!args.serviceAccount) {
    throw new Error('Pass --service-account <path> or set FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_B64.')
  }
  const resolved = path.isAbsolute(args.serviceAccount)
    ? args.serviceAccount
    : path.resolve(process.cwd(), args.serviceAccount)
  return JSON.parse(fs.readFileSync(resolved, 'utf8'))
}

/** Mirrors hasApplicationForUser / hasParticipantForUser in src/services/applicationsService.ts. */
async function hasOwnerRecord(db, collectionName, ownerFields, uid, email) {
  const direct = await db.collection(collectionName).doc(uid).get()
  if (direct.exists) return true

  for (const field of ownerFields) {
    const snapshot = await db.collection(collectionName).where(field, '==', uid).limit(1).get()
    if (!snapshot.empty) return true
  }

  if (email) {
    const byEmail = await db.collection(collectionName).where('email', '==', email).limit(1).get()
    if (!byEmail.empty) return true

    const byLowerEmail = await db.collection(collectionName).where('emailLower', '==', email.toLowerCase()).limit(1).get()
    if (!byLowerEmail.empty) return true
  }

  return false
}

async function describeSme(db, docSnapshot) {
  const data = docSnapshot.data() || {}
  const email = String(data.email || '')
  const uid = docSnapshot.id
  const companyCode = String(data.companyCode || '').trim()

  // isApplicantWorkspaceUser honours an explicit boolean on the user document before
  // looking at participants/applications, so report it - it overrides everything below.
  const explicitIsApplicant = typeof data.isApplicant === 'boolean' ? data.isApplicant : undefined

  const isParticipant = await hasOwnerRecord(db, 'participants', ['uid', 'userId', 'participantId', 'ownerUid'], uid, email)
  const hasApplication = isParticipant
    ? true
    : await hasOwnerRecord(db, 'applications', ['uid', 'userId', 'participantId'], uid, email)
  const isApplicant = explicitIsApplicant !== undefined ? explicitIsApplicant : (!isParticipant && !hasApplication)

  return {
    uid,
    email,
    name: String(data.displayName || data.name || ''),
    companyCode,
    resolvedCompanyCode: companyCode || PLATFORM_OWNER_CODE,
    isParticipant,
    hasApplication,
    explicitIsApplicant,
    isApplicant,
    seesMarketplace: (companyCode || PLATFORM_OWNER_CODE) === PLATFORM_OWNER_CODE && isApplicant,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const serviceAccount = loadServiceAccount(args)

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  const db = admin.firestore()

  const snapshot = await db.collection('users').where('role', '==', 'incubatee').get()
  if (snapshot.empty) {
    console.log('No users with role "incubatee" found.')
    return
  }

  const smes = []
  for (const row of snapshot.docs) smes.push(await describeSme(db, row))
  smes.sort((left, right) => Number(right.seesMarketplace) - Number(left.seesMarketplace))

  console.log(`\nSMEs (role: incubatee): ${smes.length}\n`)
  for (const sme of smes) {
    const audience = sme.isApplicant ? 'applicant' : 'incubatee'
    const marketplace = sme.seesMarketplace ? 'MARKETPLACE' : '-'
    const explicit = sme.explicitIsApplicant === undefined ? 'computed' : `explicit:${sme.explicitIsApplicant}`
    const blockers = [sme.isParticipant ? 'participant' : null, sme.hasApplication ? 'application' : null].filter(Boolean).join('+') || 'none'
    console.log(
      `  ${(sme.email || '(no email)').padEnd(38)} code=${(sme.companyCode || '(blank)').padEnd(10)} ` +
      `resolved=${sme.resolvedCompanyCode.padEnd(6)} audience=${audience.padEnd(9)} records=${blockers.padEnd(22)} ${marketplace}`,
    )
  }

  // What the marketplace will actually have to show: published, accepting consultants and active agents.
  const consultantSnapshot = await db.collection('consultantProfiles').where('status', '==', 'published').get()
  const acceptingConsultants = consultantSnapshot.docs.filter((row) => row.data().acceptingClients !== false)
  const agentSnapshot = await db.collection('agents').get()
  const activeAgents = agentSnapshot.docs.filter((row) => {
    const status = String(row.data().status || '').toLowerCase()
    return row.data().isActive !== false && status !== 'inactive' && status !== 'disabled'
  })
  const allProfiles = await db.collection('consultantProfiles').get()
  const draftProfiles = allProfiles.docs.filter((row) => String(row.data().status || 'draft') !== 'published')
  const consultantUsers = await db.collection('users').where('role', '==', 'consultant').get()
  console.log(`
Marketplace catalogue: ${acceptingConsultants.length} published consultant(s) accepting clients, ${activeAgents.length} agent(s).`)
  console.log(`Consultant pipeline  : ${consultantUsers.size} consultant user(s), ${allProfiles.size} profile(s) - ${draftProfiles.length} still draft.`)
  for (const row of draftProfiles) {
    const data = row.data()
    console.log(`    draft: ${String(data.email || row.id)} services=${(data.services || []).length} accepting=${data.acceptingClients !== false}`)
  }

  if (args.list || !args.email) {
    if (!args.email) console.log('\nPass --email <address> to change one SME, then --apply to write it.')
    return
  }

  const target = smes.find((sme) => sme.email.toLowerCase() === args.email.toLowerCase())
  if (!target) throw new Error(`No SME with role "incubatee" and email ${args.email}.`)

  const nextCode = args.code === undefined ? PLATFORM_OWNER_CODE : args.code.trim()
  console.log(`\nTarget : ${target.email} (${target.uid})`)
  console.log(`Before : companyCode = ${target.companyCode || '(blank)'}`)
  console.log(`After  : companyCode = ${nextCode || '(cleared)'}`)

  if (!target.isApplicant) {
    console.log(
      '\nNote: this SME has a participant or application record, so their workspace audience is ' +
      '"incubatee". They will NOT see the marketplace even with companyCode QTX - they request ' +
      'support from the interventions page instead. Pick an SME marked MARKETPLACE-eligible above.',
    )
  }

  if (!args.apply) {
    console.log('\nDry run. Re-run with --apply to write this change.')
    return
  }

  await db.collection('users').doc(target.uid).set(
    { companyCode: nextCode || null, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true },
  )
  console.log(`\nDone. ${target.email} now has companyCode = ${nextCode || '(cleared)'}.`)
  console.log(`Undo: --email ${target.email} --code ${target.companyCode || "''"} --apply`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exitCode = 1
})
