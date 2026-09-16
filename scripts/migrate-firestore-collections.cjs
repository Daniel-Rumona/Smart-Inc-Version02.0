#!/usr/bin/env node

/*
 * Firestore collection migration for the Smart Incubation schema cleanup.
 *
 * Dry run:
 *   node scripts/migrate-firestore-collections.cjs --old ./old-service-account.json --new ./new-service-account.json
 *
 * Write:
 *   node scripts/migrate-firestore-collections.cjs --old ./old-service-account.json --new ./new-service-account.json --write
 *
 * Optional:
 *   --only applications,participants,interventions
 *   --skip usageSessions,usagePageViews
 *   --overwrite
 */

const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')

const requireFromFunctions = createRequire(path.resolve(__dirname, '../functions/package.json'))
const admin = requireFromFunctions('firebase-admin')

const BATCH_LIMIT = 450

const collectionMappings = [
  { from: 'users', to: 'users', transform: transformUser },
  { from: 'systemSettings', to: 'companies', transform: transformCompanySettings },
  { from: 'branches', to: 'branches', transform: transformBranch },
  { from: 'departments', to: 'departments', transform: transformDepartment },
  { from: 'programs', to: 'programs', transform: transformProgram },
  { from: 'incubationPrograms', to: 'programs', transform: transformProgram },
  { from: 'applications', to: 'applicantProfiles', transform: transformApplicationApplicantProfile },
  { from: 'applications', to: 'businessProfiles', transform: transformApplicationBusinessProfile },
  { from: 'applications', to: 'applications', transform: transformApplication },
  { from: 'applications', to: 'participants', transform: transformAcceptedApplicationParticipant },
  { from: 'participants', to: 'applicantProfiles', transform: transformApplicantProfile },
  { from: 'participants', to: 'businessProfiles', transform: transformBusinessProfile },
  { from: 'participants', to: 'participants', transform: transformParticipant },
  { from: 'interventions', to: 'interventionDefinitions', transform: transformInterventionDefinition },
  { from: 'interventionsDatabase', to: 'interventionCompletions', transform: transformInterventionCompletion, requiresVerifiedOwner: true },
  { from: 'assignedInterventions', to: 'assignedInterventions', transform: transformAssignedIntervention, requiresVerifiedOwner: true },
  { from: 'participantComplianceTimeline', to: 'complianceDocuments', transform: transformComplianceDocument, requiresVerifiedOwner: true },
  { from: 'programComplianceRequirements', to: 'programComplianceRequirements', transform: transformComplianceRequirement },
  { from: 'formAssignments', to: 'formAssignments', transform: transformFormAssignment, requiresVerifiedOwner: true },
  { from: 'formRequests', to: 'formRequests', transform: transformFormRequest, requiresVerifiedOwner: true },
  { from: 'formResponses', to: 'formResponses', transform: transformFormResponse, requiresVerifiedOwner: true },
  { from: 'formTemplates', to: 'formTemplates', transform: normalizeCommonNames },
  { from: 'notifications', to: 'notifications', transform: transformNotification, requiresVerifiedOwner: true },
  { from: 'appointments', to: 'appointments', transform: normalizeCommonNames },
  { from: 'assignees', to: 'assignees', transform: normalizeCommonNames },
  { from: 'consultants', to: 'consultants', transform: normalizeCommonNames },
  { from: 'consolidatedMOVs', to: 'consolidatedMOVs', transform: normalizeCommonNames, requiresVerifiedOwner: true },
  { from: 'courses', to: 'courses', transform: normalizeCommonNames },
  { from: 'enrollments', to: 'enrollments', transform: normalizeCommonNames },
  { from: 'events', to: 'events', transform: normalizeCommonNames },
  { from: 'expenseTypes', to: 'expenseTypes', transform: normalizeCommonNames },
  { from: 'groupAssignments', to: 'groupAssignments', transform: normalizeCommonNames },
  { from: 'indicativeCalender', to: 'indicativeCalendar', transform: normalizeCommonNames },
  { from: 'inquiries', to: 'inquiries', transform: normalizeCommonNames },
  { from: 'invoices', to: 'invoices', transform: normalizeCommonNames },
  { from: 'leaveRequests', to: 'leaveRequests', transform: normalizeCommonNames },
  { from: 'monthlyPerformance', to: 'monthlyPerformance', transform: transformMonthlyPerformance, requiresVerifiedOwner: true },
  { from: 'operationsStaff', to: 'operationsStaff', transform: transformStaff },
  { from: 'operationStaff', to: 'operationsStaff', transform: transformStaff },
  { from: 'participantAuditTrail', to: 'participantAuditTrail', transform: normalizeCommonNames, requiresVerifiedOwner: true },
  { from: 'participantProgramRemovals', to: 'participantProgramRemovals', transform: normalizeCommonNames, requiresVerifiedOwner: true },
  {
    from: 'programExpenses',
    to: 'programs/{programId}/expenses',
    transform: transformProgramExpense,
    targetPath: (row, sourceId) => {
      const programId = stringValue(row.programId)
      return programId ? `programs/${programId}/expenses/${sourceId}` : null
    },
  },
  { from: 'reminderRules', to: 'reminderRules', transform: normalizeCommonNames },
  { from: 'resourceAllocations', to: 'resourceAllocations', transform: normalizeCommonNames },
  { from: 'resourceRequests', to: 'resourceRequests', transform: normalizeCommonNames },
  { from: 'resources', to: 'resources', transform: normalizeCommonNames },
  { from: 'smeIntakeSubmissions', to: 'smeIntakeSubmissions', transform: normalizeCommonNames },
  { from: 'successStories', to: 'successStories', transform: normalizeCommonNames },
  { from: 'supportPrograms', to: 'supportPrograms', transform: normalizeCommonNames },
  { from: 'systemSettingsChangeRequests', to: 'systemSettingsChangeRequests', transform: normalizeCommonNames },
  { from: 'taskReminders', to: 'taskReminders', transform: normalizeCommonNames },
  { from: 'tasks', to: 'tasks', transform: normalizeCommonNames },
  { from: 'emailTemplates', to: 'emailTemplates', transform: normalizeCommonNames },
  { from: 'usageSessions', to: 'usageSessions', transform: normalizeCommonNames },
  { from: 'usagePageViews', to: 'usagePageViews', transform: normalizeCommonNames },
]

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    return
  }

  if (!args.old || !args.new) {
    printUsage()
    process.exitCode = 1
    return
  }

  const oldFirebase = initFirebase('old', args.old)
  const newFirebase = initFirebase('new', args.new)
  const oldDb = oldFirebase.db
  const newDb = newFirebase.db
  const selected = filterMappings(collectionMappings, args)
  const context = await buildContext(oldFirebase)
  const mode = args.write ? 'WRITE' : 'DRY RUN'

  console.log(`Smart Incubation Firestore migration (${mode})`)
  console.log(`Mappings selected: ${selected.length}`)
  console.log(args.write ? 'Writes are enabled.' : 'No writes will be made. Add --write to migrate.')

  const totals = { read: 0, written: 0, skipped: 0, missing: 0 }

  for (const mapping of selected) {
    const result = await migrateCollection({ oldDb, newDb, mapping, context, args })
    totals.read += result.read
    totals.written += result.written
    totals.skipped += result.skipped
    totals.missing += result.missing
  }

  console.log('\nDone.')
  console.table(totals)
}

async function migrateCollection({ oldDb, newDb, mapping, context, args }) {
  const result = { read: 0, written: 0, skipped: 0, missing: 0 }
  const sourceRef = oldDb.collection(mapping.from)
  const snapshot = await sourceRef.get()

  if (snapshot.empty) {
    result.missing += 1
    console.log(`- ${mapping.from} -> ${mapping.to}: source empty or missing`)
    return result
  }

  let batch = newDb.batch()
  let batchCount = 0
  let writeCount = 0

  for (const docSnap of snapshot.docs) {
    result.read += 1
    const original = docSnap.data()
    if (mapping.requiresVerifiedOwner && !isVerifiedOwner(original, docSnap.id, context)) {
      result.skipped += 1
      continue
    }

    const transformed = mapping.transform(original, docSnap.id, context)

    if (!transformed) {
      result.skipped += 1
      continue
    }

    const rows = Array.isArray(transformed) ? transformed : [transformed]
    for (const row of rows) {
      if (!row) continue
      const targetId = row.id || docSnap.id
      const target = resolveTargetRef(newDb, mapping, row, docSnap.id, targetId)
      if (!target) {
        result.skipped += 1
        continue
      }
      const payload = stripUndefined({ ...row, id: undefined })

      if (args.write) {
        if (!args.overwrite) {
          const existing = await target.get()
          if (existing.exists) {
            result.skipped += 1
            continue
          }
        }

        if (args.overwrite) {
          batch.set(target, payload, { merge: true })
        } else {
          batch.set(target, payload)
        }
        batchCount += 1
        if (batchCount >= BATCH_LIMIT) {
          await batch.commit()
          writeCount += batchCount
          batch = newDb.batch()
          batchCount = 0
        }
      } else {
        writeCount += 1
      }
    }
  }

  if (args.write && batchCount > 0) {
    await batch.commit()
    writeCount += batchCount
  }

  result.written += writeCount
  console.log(`- ${mapping.from} -> ${mapping.to}: read ${result.read}, ${args.write ? 'wrote' : 'would write'} ${writeCount}, skipped ${result.skipped}`)
  return result
}

async function buildContext(oldFirebase) {
  const oldDb = oldFirebase.db
  const [applications, participants, programs] = await Promise.all([
    readCollectionMap(oldDb, 'applications'),
    readCollectionMap(oldDb, 'participants'),
    readCollectionMap(oldDb, 'programs'),
  ])

  const applicationsByParticipantId = new Map()
  for (const [id, app] of applications) {
    const participantId = stringValue(app.participantId || app.uid || id)
    if (!participantId) continue
    const existing = applicationsByParticipantId.get(participantId) || []
    existing.push({ id, ...app })
    applicationsByParticipantId.set(participantId, existing)
  }

  const verifiedUsers = await buildVerifiedUserIndex(oldFirebase.auth, oldDb)

  return { applications, participants, programs, applicationsByParticipantId, verifiedUsers }
}

async function readCollectionMap(db, collectionName) {
  const snapshot = await db.collection(collectionName).get()
  return new Map(snapshot.docs.map((docSnap) => [docSnap.id, docSnap.data()]))
}

async function buildVerifiedUserIndex(auth, db) {
  const snapshot = await db.collection('users').get()
  const verified = {
    ids: new Set(),
    emails: new Set(),
    skipped: 0,
  }
  const authUsersById = new Map()
  const authUsersByEmail = new Map()
  let pageToken

  do {
    const page = await auth.listUsers(1000, pageToken)
    for (const user of page.users) {
      authUsersById.set(user.uid, user)
      if (user.email) authUsersByEmail.set(lower(user.email), user)
    }
    pageToken = page.pageToken
  } while (pageToken)

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data()
    const uid = stringValue(data.uid || docSnap.id)
    const email = lower(data.email)
    const userRecord = authUsersById.get(uid) || authUsersByEmail.get(email) || null

    if (!userRecord?.emailVerified) {
      verified.skipped += 1
      continue
    }

    if (userRecord.uid) verified.ids.add(userRecord.uid)
    if (userRecord.email) verified.emails.add(lower(userRecord.email))
    if (uid) verified.ids.add(uid)
    if (email) verified.emails.add(email)
  }

  console.log(`Verified user filter: ${verified.ids.size} verified user id(s), ${verified.skipped} unverified/missing user(s) will be skipped for user-owned records.`)
  return verified
}

function isVerifiedOwner(data, id, context) {
  const uid = stringValue(data.uid || data.userId || data.ownerUid || data.participantId || id)
  const email = lower(data.email || data.participantEmail || data.recipientEmail)

  if (uid && context?.verifiedUsers?.ids?.has(uid)) return true
  if (email && context?.verifiedUsers?.emails?.has(email)) return true
  return false
}

function transformUser(data, id, context) {
  if (!isVerifiedOwner(data, id, context)) return null

  return withLegacy(data, {
    uid: stringValue(data.uid || id),
    name: stringValue(data.name || data.fullName || data.displayName),
    displayName: stringValue(data.displayName || data.name || data.fullName),
    email: lower(data.email),
    phone: data.phone || null,
    role: stringValue(data.role || data.userRole || 'incubatee').toLowerCase(),
    status: normalizeStatus(data.status, data.active),
    companyCode: data.companyCode || null,
    departmentId: data.departmentId || null,
    branchId: data.branchId || null,
    avatarUrl: data.avatarUrl || null,
    avatarPath: data.avatarPath || null,
    signatureURL: data.signatureURL || null,
    mustChangePassword: asBoolean(data.mustChangePassword),
    passwordChangedAt: data.passwordChangedAt || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  })
}

function transformCompanySettings(data, id) {
  const companyCode = stringValue(data.companyCode || id)
  return withLegacy(data, {
    id: companyCode,
    companyCode,
    name: stringValue(data.companyName || data.name || companyCode),
    legalName: data.legalName || null,
    logoUrl: data.logoUrl || data.logoURL || null,
    primaryColor: data.primaryColor || null,
    secondaryColor: data.secondaryColor || null,
    address: data.address || null,
    contact: data.contact || null,
    director: data.director || null,
    signatureURL: data.signatureURL || null,
    popia: data.popia || null,
    modules: data.modules || data.settings || null,
    interventionDeliveryRoles: Array.isArray(data.interventionDeliveryRoles) ? data.interventionDeliveryRoles : null,
    consultantLabel: data.consultantLabel || null,
    smeDivisionModel: data.smeDivisionModel || null,
    hasDepartments: asBoolean(data.hasDepartments),
    status: normalizeStatus(data.status, data.isActive),
    updatedAt: data.updatedAt || null,
    updatedBy: data.updatedBy || null,
  })
}

function transformBranch(data) {
  return withLegacy(data, {
    name: data.name || null,
    code: data.code || null,
    companyCode: data.companyCode || null,
    location: data.location || {
      address: data.address || null,
      city: data.city || null,
      province: data.province || null,
      postalCode: data.postalCode || null,
      country: data.country || null,
    },
    contact: data.contact || null,
    capacity: data.capacity || null,
    status: normalizeStatus(data.status, data.isActive),
    isActive: asBoolean(data.isActive, data.status !== 'inactive'),
    createdAt: data.createdAt || null,
    createdBy: data.createdBy || null,
    updatedAt: data.updatedAt || null,
  })
}

function transformDepartment(data) {
  return withLegacy(data, {
    name: stringValue(data.name || data.departmentName),
    departmentName: stringValue(data.departmentName || data.name),
    code: data.code || null,
    description: data.description || null,
    companyCode: data.companyCode || null,
    manager: data.manager || null,
    contactEmail: lower(data.contactEmail),
    status: normalizeStatus(data.status, data.isActive),
    isActive: asBoolean(data.isActive, data.status !== 'inactive'),
    createdAt: data.createdAt || null,
    createdBy: data.createdBy || null,
    updatedAt: data.updatedAt || null,
  })
}

function transformProgram(data, id) {
  return withLegacy(data, {
    name: stringValue(data.name || data.title || data.programName || id),
    title: stringValue(data.title || data.name || data.programName || id),
    description: data.description || null,
    companyCode: data.companyCode || null,
    status: normalizeProgramStatus(data.status),
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    registrationLink: data.registrationLink || null,
    assignedAdmin: data.assignedAdmin || null,
    onboardingQuestions: data.onboardingQuestions || null,
    eligibilityCriteria: data.eligibilityCriteria || null,
    complianceSummary: data.complianceSummary || null,
    cohortYear: data.cohortYear || null,
    createdAt: data.createdAt || null,
    createdBy: data.createdBy || null,
    updatedAt: data.updatedAt || null,
  })
}

function transformApplication(data, id, context) {
  if (!isVerifiedOwner(data, id, context)) return null

  const businessName = getBusinessName(data)
  return withLegacy(data, {
    uid: stringValue(data.uid || data.userId || data.participantId),
    applicantProfileId: stringValue(data.uid || data.userId || data.participantId),
    businessProfileId: stringValue(data.participantId || data.uid || id),
    participantId: stringValue(data.participantId || data.uid || id),
    businessName,
    participantName: getParticipantName(data),
    email: lower(data.email),
    phone: data.phone || null,
    gender: data.gender || null,
    sector: data.sector || null,
    stage: data.stage || null,
    province: data.province || null,
    hub: data.hub || null,
    programId: data.programId || null,
    programName: data.programName || null,
    status: normalizeApplicationStatus(data.applicationStatus || data.status),
    applicationStatus: normalizeApplicationStatus(data.applicationStatus || data.status),
    acceptedAt: data.acceptedAt || null,
    companyCode: data.companyCode || null,
    departmentId: data.departmentId || null,
    requiredInterventions: data.requiredInterventions || null,
    complianceDocuments: data.complianceDocuments || null,
    swot: data.swot || data.SWOT || data.swotAnalysis || null,
    removedFromProgram: asBoolean(data.removedFromProgram),
    removedAt: data.removedAt || null,
    removedReason: data.removedReason || null,
    removedBy: data.removedBy || null,
    aiEvaluation: data.aiEvaluation || null,
    aiScore: data.aiScore || data.aiEvaluation?.['AI Score'] || null,
    aiRecommendation: data.aiRecommendation || data.aiEvaluation?.['AI Recommendation'] || null,
    aiJustification: data.aiJustification || data.aiEvaluation?.Justification || null,
    motivation: data.motivation || null,
    challenges: data.challenges || null,
    growthPlanDocUrl: data.growthPlanDocUrl || null,
    submittedAt: data.submittedAt || data.createdAt || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || data.lastEditedAt || null,
    updatedBy: data.updatedBy || data.lastEditedBy || null,
  })
}

function transformApplicationApplicantProfile(data, id, context) {
  if (!isVerifiedOwner(data, id, context)) return null

  const uid = stringValue(data.uid || data.userId || data.participantId)
  if (!uid) return null

  return withLegacy(data, {
    id: uid,
    uid,
    participantName: getParticipantName(data),
    email: lower(data.email),
    phone: data.phone || null,
    gender: data.gender || null,
    ageGroup: data.ageGroup || null,
    province: data.province || null,
    city: data.city || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || data.lastEditedAt || null,
  })
}

function transformApplicationBusinessProfile(data, id, context) {
  if (!isVerifiedOwner(data, id, context)) return null

  const businessProfileId = stringValue(data.participantId || data.uid || id)
  if (!businessProfileId) return null

  return withLegacy(data, {
    id: businessProfileId,
    ownerUid: stringValue(data.uid || data.userId || data.participantId),
    applicantProfileId: stringValue(data.uid || data.userId || data.participantId),
    businessName: getBusinessName(data),
    participantName: getParticipantName(data),
    email: lower(data.email),
    phone: data.phone || null,
    sector: data.sector || null,
    stage: data.stage || null,
    beeLevel: data.beeLevel || data.bbeeLevel || null,
    province: data.province || null,
    hub: data.hub || null,
    companyCode: data.companyCode || null,
    programId: data.programId || null,
    swot: data.swot || data.SWOT || data.swotAnalysis || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || data.lastEditedAt || null,
  })
}

function transformAcceptedApplicationParticipant(data, id, context) {
  if (!isVerifiedOwner(data, id, context)) return null

  if (normalizeApplicationStatus(data.applicationStatus || data.status) !== 'accepted') return null

  const participantId = stringValue(data.participantId || data.uid || id)
  return withLegacy(data, {
    id: participantId,
    uid: stringValue(data.uid || data.userId || participantId),
    applicationId: id,
    applicantProfileId: stringValue(data.uid || data.userId || participantId),
    businessProfileId: participantId,
    programId: data.programId || null,
    companyCode: data.companyCode || null,
    departmentId: data.departmentId || null,
    businessName: getBusinessName(data),
    participantName: getParticipantName(data),
    email: lower(data.email),
    phone: data.phone || null,
    sector: data.sector || null,
    stage: data.stage || null,
    province: data.province || null,
    beeLevel: data.beeLevel || data.bbeeLevel || null,
    status: data.removedFromProgram ? 'exited' : 'active',
    acceptedAt: data.acceptedAt || data.reviewedAt || null,
    acceptedBy: data.acceptedBy || data.reviewedBy || null,
    exitReason: data.removedReason || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || data.lastEditedAt || null,
  })
}

function transformApplicantProfile(data, id, context) {
  if (!isVerifiedOwner(data, id, context)) return null

  return withLegacy(data, {
    id: stringValue(data.uid || data.participantId || id),
    uid: stringValue(data.uid || data.participantId || id),
    participantName: getParticipantName(data),
    email: lower(data.email),
    phone: data.phone || null,
    gender: data.gender || null,
    idNumber: data.idNumber || null,
    age: data.age || null,
    ageGroup: data.ageGroup || null,
    province: data.province || data.location?.province || null,
    city: data.city || data.location?.city || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  })
}

function transformBusinessProfile(data, id, context) {
  if (!isVerifiedOwner(data, id, context)) return null

  return withLegacy(data, {
    id: stringValue(data.participantId || data.uid || id),
    ownerUid: stringValue(data.uid || data.participantId || id),
    applicantProfileId: stringValue(data.uid || data.participantId || id),
    businessName: getBusinessName(data),
    participantName: getParticipantName(data),
    email: lower(data.email),
    phone: data.phone || null,
    sector: data.sector || null,
    natureOfBusiness: data.natureOfBusiness || null,
    stage: data.stage || null,
    beeLevel: data.beeLevel || null,
    registrationNumber: data.registrationNumber || null,
    dateOfRegistration: data.dateOfRegistration || null,
    yearsOfTrading: data.yearsOfTrading || null,
    developmentType: data.developmentType || null,
    ownership: pickOwnership(data),
    businessAddress: data.businessAddress || null,
    province: data.province || data.businessAddressProvince || data.location?.province || null,
    city: data.city || data.location?.city || null,
    postalCode: data.postalCode || data.location?.postalCode || null,
    hub: data.hub || null,
    websiteUrl: data.websiteUrl || null,
    socialMedia: data.socialMedia || null,
    swot: data.swot || data.SWOT || data.swotAnalysis || null,
    companyCode: data.companyCode || null,
    programId: data.programId || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  })
}

function transformParticipant(data, id, context) {
  if (!isVerifiedOwner(data, id, context)) return null

  const participantId = stringValue(data.participantId || data.uid || id)
  const applications = context.applicationsByParticipantId.get(participantId) || []
  const acceptedApplication = applications.find((app) => normalizeApplicationStatus(app.applicationStatus || app.status) === 'accepted')
  const application = acceptedApplication || applications[0] || {}

  return withLegacy(data, {
    id: participantId,
    uid: stringValue(data.uid || participantId),
    applicationId: application.id || null,
    applicantProfileId: stringValue(data.uid || participantId),
    businessProfileId: participantId,
    programId: data.programId || application.programId || null,
    companyCode: data.companyCode || application.companyCode || null,
    departmentId: data.departmentId || application.departmentId || null,
    businessName: getBusinessName(data) || getBusinessName(application),
    participantName: getParticipantName(data) || getParticipantName(application),
    email: lower(data.email || application.email),
    phone: data.phone || application.phone || null,
    sector: data.sector || application.sector || null,
    stage: data.stage || application.stage || null,
    province: data.province || application.province || null,
    beeLevel: data.beeLevel || application.beeLevel || null,
    status: acceptedApplication ? 'active' : normalizeStatus(data.status, true),
    acceptedAt: acceptedApplication?.acceptedAt || null,
    acceptedBy: acceptedApplication?.acceptedBy || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  })
}

function transformInterventionDefinition(data) {
  return withLegacy(data, {
    interventionTitle: stringValue(data.interventionTitle || data.title || data.name),
    title: stringValue(data.title || data.interventionTitle || data.name),
    subtitle: data.subtitle || null,
    areaOfSupport: data.areaOfSupport || data.department || null,
    department: data.department || null,
    departmentId: data.departmentId || null,
    description: data.description || null,
    type: data.type || null,
    targetType: data.targetType || null,
    targetValue: data.targetValue || null,
    targetMetric: data.targetMetric || null,
    isCompulsory: asBoolean(data.isCompulsory),
    isRecurring: asBoolean(data.isRecurring),
    status: normalizeStatus(data.status, true),
    companyCode: data.companyCode || null,
    createdAt: data.createdAt || null,
    createdBy: data.createdBy || null,
    updatedAt: data.updatedAt || null,
    updatedBy: data.updatedBy || null,
  })
}

function transformInterventionCompletion(data, id) {
  return withLegacy(data, {
    assignedInterventionId: data.assignedInterventionId || data.assignmentId || null,
    participantId: data.participantId || null,
    businessName: getBusinessName(data),
    consultantIds: data.consultantIds || null,
    interventionDefinitionId: data.interventionId || data.interventionKey || id,
    interventionId: data.interventionId || data.interventionKey || id,
    interventionTitle: stringValue(data.interventionTitle || data.title || data.interventionName),
    areaOfSupport: data.areaOfSupport || data.department || null,
    department: data.department || null,
    departmentId: data.departmentId || null,
    method: data.method || data.interventionMethod || null,
    interventionDate: data.interventionDate || data.date || null,
    completedAt: data.completedAt || data.interventionDate || data.updatedAt || data.createdAt || null,
    status: data.status || 'completed',
    companyCode: data.companyCode || null,
    mov: pickMovFields(data),
    snapshot: data.snapshot || null,
    createdAt: data.createdAt || null,
    createdBy: data.createdBy || null,
    updatedAt: data.updatedAt || null,
    updatedBy: data.updatedBy || null,
  })
}

function transformAssignedIntervention(data) {
  return withLegacy(data, {
    companyCode: data.companyCode || null,
    groupId: data.groupId || null,
    participantId: data.participantId || null,
    businessName: getBusinessName(data),
    interventionDefinitionId: data.interventionId || null,
    interventionId: data.interventionId || null,
    interventionTitle: stringValue(data.interventionTitle || data.title),
    subtitle: data.subtitle || null,
    type: data.type || null,
    implementationDate: data.implementationDate || null,
    dueDate: data.dueDate || null,
    isRecurring: asBoolean(data.isRecurring),
    assigneeType: data.assigneeType || null,
    assigneeUid: data.assigneeUid || data.assigneeId || null,
    assigneeId: data.assigneeId || null,
    assigneeName: data.assigneeName || null,
    assigneeEmail: lower(data.assigneeEmail),
    status: normalizeAssignedStatus(data),
    assigneeStatus: normalizeLooseStatus(data.assigneeStatus),
    participantStatus: normalizeLooseStatus(data.participantStatus || data.incubateeStatus),
    completionStatus: normalizeLooseStatus(data.completionStatus || data.incubateeCompletionStatus),
    assigneeCompletionStatus: normalizeLooseStatus(data.assigneeCompletionStatus),
    participantCompletionStatus: normalizeLooseStatus(data.participantCompletionStatus || data.incubateeCompletionStatus),
    createdAt: data.createdAt || null,
    createdBy: data.createdBy || null,
    updatedAt: data.updatedAt || null,
    updatedBy: data.updatedBy || null,
    timeSpent: data.timeSpent || null,
    progress: numberValue(data.progress),
    notes: data.notes || null,
    feedback: data.feedback || null,
    targetType: data.targetType || null,
    targetValue: data.targetValue || null,
    targetMetric: data.targetMetric || null,
    areaOfSupport: data.areaOfSupport || null,
    overdueReason: data.overdueReason || null,
    overdueReasonBy: data.overdueReasonBy || null,
    overdueReasonAt: data.overdueReasonAt || null,
    resources: data.resources || [],
    reassignmentHistory: data.reassignmentHistory || [],
    snapshot: data.snapshot || null,
  })
}

function transformComplianceDocument(data, id) {
  return withLegacy(data, {
    participantId: data.participantId || null,
    applicationId: data.applicationId || null,
    programId: data.programId || null,
    companyCode: data.companyCode || null,
    departmentId: data.departmentId || null,
    key: data.key || cleanKey(data.type || data.documentName || id),
    type: data.type || data.documentName || data.key || 'Document',
    documentName: data.documentName || data.type || data.key || 'Document',
    currentStatus: normalizeComplianceStatus(data.currentStatus || data.status),
    verificationStatus: normalizeVerificationStatus(data.verificationStatus),
    verificationComment: data.verificationComment || '',
    issueDate: data.issueDate || null,
    expiryDate: data.expiryDate || null,
    notes: data.notes || null,
    fileName: data.fileName || null,
    url: data.url || data.fileUrl || null,
    storagePath: data.storagePath || null,
    createdAt: data.createdAt || null,
    createdBy: data.createdBy || null,
    updatedAt: data.updatedAt || null,
    updatedBy: data.updatedBy || null,
    verifiedAt: data.verifiedAt || null,
    verifiedBy: data.verifiedBy || null,
  })
}

function transformComplianceRequirement(data) {
  return withLegacy(data, {
    companyCode: data.companyCode || null,
    programId: data.programId || null,
    name: data.name || data.title || null,
    normalizedName: data.normalizedName || cleanKey(data.name || data.title),
    description: data.description || null,
    category: data.category || null,
    requirementType: data.requirementType || null,
    isRequired: asBoolean(data.isRequired, true),
    allowedFormats: data.allowedFormats || [],
    maxSizeMB: data.maxSizeMB || null,
    version: data.version || null,
    isActive: asBoolean(data.isActive, true),
    isCustom: asBoolean(data.isCustom),
    templateSource: data.templateSource || null,
    createdAt: data.createdAt || null,
    createdBy: data.createdBy || null,
    updatedAt: data.updatedAt || null,
  })
}

function transformFormAssignment(data) {
  return withLegacy(data, {
    templateId: data.templateId || null,
    templateTitle: data.templateTitle || data.title || null,
    applicationId: data.applicationId || null,
    participantId: data.participantId || null,
    recipientEmail: lower(data.recipientEmail),
    recipientName: data.recipientName || getParticipantName(data),
    companyCode: data.companyCode || null,
    status: normalizeLooseStatus(data.status || 'pending'),
    assignedAt: data.assignedAt || data.createdAt || null,
    assignedBy: data.assignedBy || data.createdBy || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  })
}

function transformFormRequest(data) {
  return withLegacy(data, {
    templateId: data.templateId || null,
    formId: data.formId || null,
    participantId: data.participantId || null,
    participantName: getParticipantName(data),
    participantEmail: lower(data.participantEmail || data.email),
    companyCode: data.companyCode || null,
    status: normalizeLooseStatus(data.status || 'pending'),
    attemptCount: numberValue(data.attemptCount),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  })
}

function transformFormResponse(data) {
  return withLegacy(data, {
    templateId: data.templateId || null,
    formId: data.formId || null,
    requestId: data.requestId || null,
    formTitle: data.formTitle || data.title || null,
    kind: data.kind || null,
    companyCode: data.companyCode || null,
    participantId: data.participantId || null,
    submittedBy: data.submittedBy || null,
    submittedAt: data.submittedAt || null,
    status: normalizeLooseStatus(data.status),
    answers: data.answers || null,
    completion: data.completion || null,
    timing: data.timing || null,
    score: data.score || data.grade || null,
    grade: data.grade || data.score || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  })
}

function transformNotification(data) {
  return withLegacy(data, {
    to: data.to || data.userId || null,
    userId: data.userId || data.to || null,
    participantId: data.participantId || null,
    title: data.title || null,
    message: data.message || null,
    type: data.type || null,
    read: asBoolean(data.read),
    readBy: data.readBy || null,
    companyCode: data.companyCode || null,
    metadata: data.metadata || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  })
}

function transformStaff(data) {
  return withLegacy(data, {
    uid: data.uid || null,
    name: stringValue(data.name || data.fullName || data.displayName),
    email: lower(data.email),
    role: data.role || null,
    companyCode: data.companyCode || null,
    status: normalizeStatus(data.status, data.active),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  })
}

function transformProgramExpense(data) {
  if (!data.programId) return null

  return {
    programId: data.programId,
    companyCode: data.companyCode || null,
    amount: data.amount || 0,
    category: data.category || data.type || null,
    type: data.type || data.category || null,
    description: data.description || null,
    date: data.date || null,
    createdAt: data.createdAt || null,
    createdBy: data.createdBy || null,
    updatedAt: data.updatedAt || null,
    updatedBy: data.updatedBy || null,
  }
}

function transformMonthlyPerformance(data, id) {
  const nonMetricFields = new Set([
    'id',
    'uid',
    'email',
    'participantId',
    'businessName',
    'participantName',
    'companyCode',
    'programId',
    'createdAt',
    'updatedAt',
    '_legacy',
  ])
  const metricKeys = Object.keys(data).filter((key) => !nonMetricFields.has(key))

  if (!metricKeys.length) return null

  return withLegacy(data, {
    participantId: data.participantId || id,
    email: lower(data.email),
    businessName: getBusinessName(data) || null,
    participantName: getParticipantName(data) || null,
    companyCode: data.companyCode || null,
    programId: data.programId || null,
    metrics: metricKeys.reduce((metrics, key) => {
      metrics[key] = data[key]
      return metrics
    }, {}),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  })
}

function normalizeCommonNames(data) {
  const output = { ...data }
  const businessName = getBusinessName(data)
  if (businessName) output.businessName = businessName
  delete output.beneficiaryName
  return output
}

function withLegacy(original, normalized) {
  return stripUndefined(normalized)
}

function getBusinessName(data) {
  return stringValue(data.businessName || data.beneficiaryName || data.requesterName || data.requestedByName)
}

function getParticipantName(data) {
  return stringValue(data.participantName || data.fullName || data.contactName || data.recipientName || data.name)
}

function pickOwnership(data) {
  const ownership = {}
  for (const [key, value] of Object.entries(data)) {
    if (/ownership|owned|black|women|youth/i.test(key)) ownership[key] = value
  }
  return Object.keys(ownership).length ? ownership : null
}

function pickMovFields(data) {
  const keys = [
    'interventionKey',
    'smmeNo',
    'smmeSector',
    'groupStage',
    'interventionMethod',
    'frequencyOfIntervention',
    'interventionType',
    'facilitatorName',
    'facilitatorId',
    'signatures',
    'finalCheckerName',
    'finalCheckerId',
    'dateChecked',
    'notes',
    'attachments',
  ]
  const mov = {}
  for (const key of keys) {
    if (data[key] !== undefined) mov[key] = data[key]
  }
  return Object.keys(mov).length ? mov : null
}

function normalizeAssignedStatus(data) {
  const raw = normalizeLooseStatus(data.status)
  if (raw) return raw
  if (normalizeLooseStatus(data.incubateeCompletionStatus) === 'confirmed') return 'completed'
  if (numberValue(data.progress) >= 100) return 'awaiting-confirmation'
  if (normalizeLooseStatus(data.incubateeStatus) === 'accepted') return 'in-progress'
  return 'pending-assignment'
}

function normalizeApplicationStatus(value) {
  const status = normalizeLooseStatus(value)
  if (!status) return 'pending'
  if (status === 'approved') return 'accepted'
  if (status === 'declined') return 'rejected'
  return status
}

function normalizeProgramStatus(value) {
  const status = normalizeLooseStatus(value)
  if (!status) return 'active'
  if (status === 'upcoming') return 'planned'
  return status
}

function normalizeComplianceStatus(value) {
  const status = normalizeLooseStatus(value)
  if (['pending', 'valid', 'queried', 'invalid', 'expired'].includes(status)) return status
  if (status === 'verified' || status === 'approved') return 'valid'
  return 'pending'
}

function normalizeVerificationStatus(value) {
  const status = normalizeLooseStatus(value)
  if (['pending', 'verified', 'queried'].includes(status)) return status
  if (status === 'approved' || status === 'valid') return 'verified'
  return 'pending'
}

function normalizeStatus(status, activeFallback) {
  const normalized = normalizeLooseStatus(status)
  if (normalized) {
    if (normalized === 'enabled') return 'active'
    if (normalized === 'disabled') return 'inactive'
    return normalized
  }
  return asBoolean(activeFallback, true) ? 'active' : 'inactive'
}

function normalizeLooseStatus(value) {
  return stringValue(value).trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-')
}

function asBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const normalized = stringValue(value).trim().toLowerCase()
  if (['yes', 'y', 'true', '1', 'active', 'enabled'].includes(normalized)) return true
  if (['no', 'n', 'false', '0', 'inactive', 'disabled'].includes(normalized)) return false
  return fallback
}

function numberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function lower(value) {
  const text = stringValue(value)
  return text ? text.toLowerCase() : ''
}

function stringValue(value) {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function cleanKey(value) {
  return stringValue(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined)
  if (!value || typeof value !== 'object') return value

  const output = {}
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue
    output[key] = stripUndefined(entry)
  }
  return output
}

function filterMappings(mappings, args) {
  const only = splitList(args.only)
  const skip = splitList(args.skip)
  return mappings.filter((mapping) => {
    const names = new Set([mapping.from, mapping.to])
    if (only.size && ![...names].some((name) => only.has(name))) return false
    if ([...names].some((name) => skip.has(name))) return false
    return true
  })
}

function splitList(value) {
  return new Set(stringValue(value).split(',').map((item) => item.trim()).filter(Boolean))
}

function initFirebase(name, serviceAccountPath) {
  const resolved = path.resolve(serviceAccountPath)
  const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'))
  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  }, name)
  return {
    app,
    db: app.firestore(),
    auth: admin.auth(app),
  }
}

function resolveTargetRef(db, mapping, row, sourceId, fallbackTargetId) {
  if (typeof mapping.targetPath === 'function') {
    const targetPath = mapping.targetPath(row, sourceId)
    return targetPath ? db.doc(targetPath) : null
  }

  return db.collection(mapping.to).doc(String(fallbackTargetId))
}

function parseArgs(argv) {
  const args = { write: false, overwrite: false }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--write') args.write = true
    else if (arg === '--overwrite') args.overwrite = true
    else if (arg.startsWith('--old=')) args.old = arg.slice('--old='.length)
    else if (arg === '--old') args.old = argv[++index]
    else if (arg.startsWith('--new=')) args.new = arg.slice('--new='.length)
    else if (arg === '--new') args.new = argv[++index]
    else if (arg.startsWith('--only=')) args.only = arg.slice('--only='.length)
    else if (arg === '--only') args.only = argv[++index]
    else if (arg.startsWith('--skip=')) args.skip = arg.slice('--skip='.length)
    else if (arg === '--skip') args.skip = argv[++index]
    else if (arg === '--help' || arg === '-h') args.help = true
  }

  return args
}

function printUsage() {
  console.log(`
Usage:
  node scripts/migrate-firestore-collections.cjs --old ./old-service-account.json --new ./new-service-account.json
  node scripts/migrate-firestore-collections.cjs --old ./old-service-account.json --new ./new-service-account.json --write

Options:
  --write       Commit writes. Without this, the script only prints a dry-run plan.
  --overwrite   Use set(..., { merge: true }) even when target docs already exist.
  --only        Comma-separated collection names to include. Matches source or target names.
  --skip        Comma-separated collection names to skip. Matches source or target names.
`)
}
