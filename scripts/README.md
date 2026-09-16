# Firestore Migration Scripts

## Agent registry seed

Use `seed-agent-catalogue.cjs` to seed/update the `agents` collection (business-plan, strategic-plan, pitch-coach) used by the Firestore Agent Registry.

```bash
node scripts/seed-agent-catalogue.cjs --service-account ./new-service-account.json
```

Writes are merges, so re-running it is safe. See `firestore.rules` (project root) for the security rules this collection needs before going live — that file is currently incomplete and must be merged with your real rules before deploying.

## Smart schema cleanup

Use `migrate-firestore-collections.cjs` to migrate data from the legacy Firestore database into the new standardized collection structure.

Dry run first:

```bash
node scripts/migrate-firestore-collections.cjs --old ./old-service-account.json --new ./new-service-account.json
```

Write to the new database:

```bash
node scripts/migrate-firestore-collections.cjs --old ./old-service-account.json --new ./new-service-account.json --write
```

Overwrite/merge existing target documents:

```bash
node scripts/migrate-firestore-collections.cjs --old ./old-service-account.json --new ./new-service-account.json --write --overwrite
```

Run selected collections only:

```bash
node scripts/migrate-firestore-collections.cjs --old ./old-service-account.json --new ./new-service-account.json --only applications,participants,interventions --write
```

Skip selected collections:

```bash
node scripts/migrate-firestore-collections.cjs --old ./old-service-account.json --new ./new-service-account.json --skip usageSessions,usagePageViews --write
```

## Core schema decisions

- `beneficiaryName` is standardized to `businessName`.
- `participantName` remains the person/contact name.
- `participants` is the accepted/incubatee participant record.
- `applicantProfiles` stores applicant personal/contact details.
- `businessProfiles` stores the business/incubatee organization details.
- `interventions` migrates to `interventionDefinitions`.
- `interventionsDatabase` migrates to `interventionCompletions`.
- `assignedInterventions` remains active/in-progress assignment data.
- `participantComplianceTimeline` migrates to `complianceDocuments`.
- `indicativeCalender` migrates to the corrected `indicativeCalendar`.
- `programExpenses` migrates under each program as `programs/{programId}/expenses/{expenseId}`.

The migration writes only the normalized destination fields. It does not write `_legacy` audit payloads.

## Canonical Firestore collections

New pages and services should use the collections below. Do not introduce legacy aliases such as `beneficiaryName`, `interventionsDatabase`, or `participantComplianceTimeline`.

### `users`

Platform/auth user profile.

```ts
uid
email
name
displayName
phone
role
status
companyCode
departmentId
branchId
assignedProgramIds
permissions
avatarUrl
avatarPath
signatureURL
mustChangePassword
passwordChangedAt
firstLoginComplete
createdAt
createdBy
updatedAt
updatedBy
```

### `companies`

Tenant/company workspace settings. Logos belong here, not in a standalone `logos` collection.

```ts
companyCode
name
legalName
logoUrl
primaryColor
secondaryColor
address
contact
director
signatureURL
popia
modules
status
createdAt
updatedAt
updatedBy
```

### `branches`

Company branch/location records.

```ts
name
code
companyCode
location
contact
capacity
status
isActive
createdAt
createdBy
updatedAt
```

### `departments`

Support areas or departments.

```ts
name
departmentName
code
description
companyCode
manager
contactEmail
status
isActive
createdAt
createdBy
updatedAt
```

### `programs`

Incubation programmes/cohorts. Use this collection, not `incubationPrograms`.

```ts
name
title
description
companyCode
status
startDate
endDate
registrationLink
assignedAdmin
onboardingQuestions
eligibilityCriteria
complianceSummary
cohortYear
createdAt
createdBy
updatedAt
updatedBy
```

### `programs/{programId}/expenses`

Program-specific expenses. Do not use a top-level `programExpenses` collection for new writes.

```ts
programId
companyCode
amount
category
type
description
date
createdAt
createdBy
updatedAt
updatedBy
```

### `applicantProfiles`

Applicant personal/contact details before acceptance.

```ts
uid
participantName
email
phone
gender
idNumber
age
ageGroup
province
city
createdAt
updatedAt
```

### `businessProfiles`

Business/incubatee organization details. Use `businessName` only.

```ts
ownerUid
applicantProfileId
businessName
participantName
email
phone
sector
natureOfBusiness
stage
beeLevel
registrationNumber
dateOfRegistration
yearsOfTrading
developmentType
ownership
businessAddress
province
city
postalCode
hub
websiteUrl
socialMedia
swot
companyCode
programId
createdAt
updatedAt
```

### `applications`

Programme application submissions and review decisions.

```ts
uid
userId
applicantProfileId
businessProfileId
participantId
businessName
participantName
email
phone
gender
sector
stage
province
hub
programId
programName
companyCode
departmentId
status
applicationStatus
acceptedAt
reviewedAt
reviewedBy
requiredInterventions
complianceDocuments
swot
removedFromProgram
removedAt
removedReason
removedBy
aiEvaluation
aiScore
aiRecommendation
aiJustification
motivation
challenges
growthPlanDocUrl
submittedAt
createdAt
createdBy
updatedAt
updatedBy
```

### `participants`

Accepted incubatees only.

```ts
uid
applicationId
applicantProfileId
businessProfileId
programId
companyCode
departmentId
businessName
participantName
email
phone
sector
stage
province
beeLevel
status
acceptedAt
acceptedBy
exitReason
createdAt
updatedAt
```

### `complianceDocuments`

Participant compliance document records.

```ts
participantId
applicationId
programId
companyCode
departmentId
key
type
documentName
currentStatus
verificationStatus
verificationComment
issueDate
expiryDate
notes
fileName
url
storagePath
createdAt
createdBy
updatedAt
updatedBy
verifiedAt
verifiedBy
```

### `programComplianceRequirements`

Programme document/compliance requirements.

```ts
companyCode
programId
name
normalizedName
description
category
requirementType
isRequired
allowedFormats
maxSizeMB
version
isActive
isCustom
templateSource
createdAt
createdBy
updatedAt
```

### `interventionDefinitions`

Master list of interventions that can be offered.

```ts
interventionTitle
title
subtitle
areaOfSupport
department
departmentId
description
type
targetType
targetValue
targetMetric
isCompulsory
isRecurring
status
companyCode
createdAt
createdBy
updatedAt
updatedBy
```

### `assignedInterventions`

Active/in-progress intervention assignments.

```ts
companyCode
groupId
participantId
businessName
interventionDefinitionId
interventionId
interventionTitle
subtitle
type
implementationDate
dueDate
isRecurring
assigneeType
assigneeUid
assigneeId
assigneeName
assigneeEmail
status
assigneeStatus
participantStatus
completionStatus
assigneeCompletionStatus
participantCompletionStatus
participantAcceptedAt
completionConfirmedAt
completedAt
createdAt
createdBy
updatedAt
updatedBy
timeSpent
progress
notes
feedback
targetType
targetValue
targetMetric
areaOfSupport
overdueReason
overdueReasonBy
overdueReasonAt
resources
reassignmentHistory
snapshot
```

### `interventionCompletions`

Completed intervention history only.

```ts
assignedInterventionId
participantId
programId
companyCode
departmentId
interventionDefinitionId
interventionId
interventionTitle
areaOfSupport
department
method
interventionDate
completedAt
status
feedback
rating
comments
mov
snapshot
createdAt
createdBy
updatedAt
updatedBy
```

### `diagnosticPlans`

Diagnostic/growth plan records.

```ts
participantId
applicationId
programId
companyCode
status
confirmed
confirmedBy
confirmedMeta
confirmedAt
swot
interventions
createdAt
createdBy
updatedAt
updatedBy
```

### `interventionRequests`

Intervention requests submitted by participants.

```ts
participantId
programId
companyCode
departmentId
areaOfSupport
interventionTitle
reason
status
requestedAt
reviewedAt
reviewedBy
assignedInterventionId
createdAt
updatedAt
```

### `formTemplates`

Reusable survey/assessment templates.

```ts
title
description
fields
status
kind
companyCode
settings
createdBy
createdAt
updatedAt
```

### `formAssignments`

Assigned survey/assessment work.

```ts
templateId
templateTitle
applicationId
participantId
recipientEmail
recipientName
companyCode
status
assignedAt
assignedBy
createdAt
updatedAt
```

### `formRequests`

Form request attempts for a participant.

```ts
templateId
formId
participantId
participantName
participantEmail
companyCode
status
attemptCount
createdAt
updatedAt
```

### `formResponses`

Submitted form answers/results.

```ts
templateId
formId
requestId
formTitle
kind
companyCode
participantId
submittedBy
submittedAt
status
answers
completion
timing
score
grade
createdAt
updatedAt
```

### `notifications`

User/role notifications. Avoid migrating or writing notifications for users who do not exist in the new database.

```ts
to
userId
participantId
title
message
type
read
readBy
companyCode
metadata
createdAt
updatedAt
```

### Operational support collections

These collections remain top-level operational records:

```txt
appointments
assignees
consultants
courses
enrollments
events
expenseTypes
groupAssignments
indicativeCalendar
inquiries
invoices
leaveRequests
operationsStaff
resourceAllocations
resourceRequests
resources
smeIntakeSubmissions
successStories
supportPrograms
systemSettingsChangeRequests
taskReminders
tasks
emailTemplates
usageSessions
usagePageViews
```

### Field naming rules

- Use `businessName` for the SME/business/incubatee entity.
- Use `participantName` for the person/contact.
- Use `participantStatus`, not `beneficiaryStatus` or `incubateeStatus`.
- Use `participantCompletionStatus`, not `beneficiaryCompletionStatus` or `incubateeCompletionStatus`.
- Use `interventionDefinitions` for the catalog and `interventionCompletions` for completed work.
- Use `complianceDocuments`, not `participantComplianceTimeline`.
- Use `programs`, not `incubationPrograms`.
