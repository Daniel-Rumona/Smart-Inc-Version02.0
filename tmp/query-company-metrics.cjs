const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')

const workspace = path.resolve(__dirname, '..')
const requireFromFunctions = createRequire(path.join(workspace, 'functions', 'package.json'))
const admin = requireFromFunctions('firebase-admin')
const credential = JSON.parse(
  fs.readFileSync(path.join(workspace, 'scripts', 'new-service-account.json'), 'utf8'),
)

const app = admin.initializeApp({ credential: admin.credential.cert(credential) }, 'company-metrics-readonly')
const db = app.firestore()

const text = (value) => String(value ?? '').trim()
const normalized = (value) => text(value).toLowerCase().replace(/[\s_-]+/g, '')
const companyCode = (value) => text(value) || 'UNASSIGNED'
const isInactive = (value) => ['inactive', 'disabled', 'deleted', 'archived'].includes(normalized(value))
const isAccepted = (value) => ['accepted', 'approved'].includes(normalized(value))

const entityKeys = (data, docId) => [
  data.participantId,
  data.businessProfileId,
  data.uid,
  data.userId,
  data.applicantProfileId,
  data.email && `email:${text(data.email).toLowerCase()}`,
  docId && `doc:${docId}`,
].map(text).filter(Boolean)

async function main() {
  const [participantSnap, applicationSnap, userSnap, assigneeSnap, companySnap, settingsSnap] = await Promise.all([
    db.collection('participants').get(),
    db.collection('applications').get(),
    db.collection('users').get(),
    db.collection('assignees').get(),
    db.collection('companies').get(),
    db.collection('systemSettings').get(),
  ])

  const knownCompanyNames = new Map()
  for (const row of [...companySnap.docs, ...settingsSnap.docs]) {
    const data = row.data()
    const code = companyCode(data.companyCode || row.id)
    const name = text(data.companyName || data.name || data.organisationName || data.organizationName)
    if (code !== 'UNASSIGNED' && name) knownCompanyNames.set(code, name)
  }

  const applications = new Map(applicationSnap.docs.map((row) => [row.id, row.data()]))
  const representedApplicationIds = new Set()
  const representedEntityKeys = new Set()
  const smeRows = []

  for (const row of participantSnap.docs) {
    const data = row.data()
    if (isInactive(data.status)) continue
    const application = data.applicationId ? applications.get(text(data.applicationId)) || {} : {}
    const code = companyCode(data.companyCode || application.companyCode)
    smeRows.push({ source: 'participant', code })
    if (data.applicationId) representedApplicationIds.add(text(data.applicationId))
    for (const key of entityKeys(data, row.id)) representedEntityKeys.add(key)
  }

  let acceptedApplicationFallbacks = 0
  let acceptedApplicationDuplicatesSkipped = 0
  for (const row of applicationSnap.docs) {
    const data = row.data()
    if (!isAccepted(data.applicationStatus || data.status)) continue
    if (representedApplicationIds.has(row.id)) continue
    const keys = entityKeys(data, row.id)
    if (keys.some((key) => representedEntityKeys.has(key))) {
      acceptedApplicationDuplicatesSkipped += 1
      continue
    }
    const code = companyCode(data.companyCode)
    smeRows.push({ source: 'accepted-application', code })
    acceptedApplicationFallbacks += 1
    for (const key of keys) representedEntityKeys.add(key)
  }

  const metrics = new Map()
  const ensure = (code) => {
    if (!metrics.has(code)) {
      metrics.set(code, {
        companyCode: code,
        companyName: knownCompanyNames.get(code) || '',
        smes: 0,
        consultants: 0,
        projectAdmins: 0,
      })
    }
    return metrics.get(code)
  }

  for (const row of smeRows) ensure(row.code).smes += 1

  let activeUsers = 0
  let excludedInactiveUsers = 0
  const workforceKeys = new Set()
  const addWorkforce = (row, source) => {
    const data = row.data()
    if (isInactive(data.status)) {
      if (source === 'users') excludedInactiveUsers += 1
      return
    }
    if (source === 'users') activeUsers += 1
    const role = normalized(data.role || data.userRole)
    if (role !== 'consultant' && role !== 'projectadmin') return
    const code = companyCode(data.companyCode)
    const identity = text(data.uid || data.userId || data.email && `email:${text(data.email).toLowerCase()}` || `${source}:${row.id}`)
    const key = `${code}|${role}|${identity}`
    if (workforceKeys.has(key)) return
    workforceKeys.add(key)
    const metric = ensure(code)
    if (role === 'consultant') metric.consultants += 1
    if (role === 'projectadmin') metric.projectAdmins += 1
  }
  for (const row of userSnap.docs) addWorkforce(row, 'users')
  for (const row of assigneeSnap.docs) addWorkforce(row, 'assignees')

  const rows = [...metrics.values()].sort((a, b) =>
    b.smes - a.smes
    || b.consultants - a.consultants
    || a.companyCode.localeCompare(b.companyCode),
  )
  const totals = rows.reduce((total, row) => ({
    smes: total.smes + row.smes,
    consultants: total.consultants + row.consultants,
    projectAdmins: total.projectAdmins + row.projectAdmins,
  }), { smes: 0, consultants: 0, projectAdmins: 0 })

  console.log(JSON.stringify({
    projectId: credential.project_id,
    generatedAt: new Date().toISOString(),
    definition: {
      smes: 'non-inactive participants plus accepted applications not represented by a participant',
      workforce: 'non-inactive users with role consultant or projectadmin',
    },
    totals,
    rows,
    diagnostics: {
      participantDocuments: participantSnap.size,
      applicationDocuments: applicationSnap.size,
      acceptedApplicationFallbacks,
      acceptedApplicationDuplicatesSkipped,
      userDocuments: userSnap.size,
      assigneeDocuments: assigneeSnap.size,
      activeUsers,
      excludedInactiveUsers,
    },
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error && error.message ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await app.delete()
  })
