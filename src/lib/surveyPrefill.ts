import type { SurveyFieldType } from '@/services/surveyTemplatesService'

/**
 * Questions whose answer already exists on the SME's record. The builder shows
 * them but does not let you configure the wording — the label is what pairs the
 * question with the stored value. The response form seeds the answer and lets
 * the SME correct it for that response without changing their profile.
 */
export type PrefillKey =
    | 'businessName'
    | 'registrationNumber'
    | 'sector'
    | 'yearsTrading'
    | 'contactName'
    | 'contactEmail'
    | 'contactPhone'
    | 'province'
    | 'city'

export const PREFILL_LABELS: Record<PrefillKey, string> = {
    businessName: 'Business name',
    registrationNumber: 'Registration number',
    sector: 'Sector',
    yearsTrading: 'Years trading',
    contactName: 'Contact name',
    contactEmail: 'Contact email',
    contactPhone: 'Contact phone',
    province: 'Province',
    city: 'City',
}

/** Where each answer is read from on the participant record, in order of preference. */
export const PREFILL_SOURCES: Record<PrefillKey, string[]> = {
    businessName: ['businessName', 'companyName', 'tradingName'],
    registrationNumber: ['registrationNumber', 'companyRegistrationNumber'],
    sector: ['sector', 'industry'],
    yearsTrading: ['yearsTrading', 'yearsOfTrading'],
    contactName: ['contactName', 'ownerName', 'displayName'],
    contactEmail: ['email', 'contactEmail'],
    contactPhone: ['phone', 'contactPhone', 'phoneNumber'],
    province: ['province', 'region'],
    city: ['city', 'town'],
}

export type PrefillSectionField = {
    prefill: PrefillKey
    label: string
    type: SurveyFieldType
}

export type PrefillSection = {
    id: string
    title: string
    description: string
    fields: PrefillSectionField[]
}

export const PREFILL_SECTIONS: PrefillSection[] = [
    {
        id: 'business-details',
        title: 'Business details',
        description: 'Name, registration and sector, straight from the SME record.',
        fields: [
            { prefill: 'businessName', label: 'Business name', type: 'text' },
            { prefill: 'registrationNumber', label: 'Registration number', type: 'text' },
            { prefill: 'sector', label: 'Sector', type: 'text' },
            { prefill: 'yearsTrading', label: 'Years trading', type: 'number' },
        ],
    },
    {
        id: 'contact-details',
        title: 'Contact details',
        description: 'Who to reach and how, without asking again.',
        fields: [
            { prefill: 'contactName', label: 'Contact name', type: 'text' },
            { prefill: 'contactEmail', label: 'Contact email', type: 'email' },
            { prefill: 'contactPhone', label: 'Contact phone', type: 'text' },
        ],
    },
    {
        id: 'location',
        title: 'Location',
        description: 'Where the business operates.',
        fields: [
            { prefill: 'province', label: 'Province', type: 'text' },
            { prefill: 'city', label: 'City', type: 'text' },
        ],
    },
]

/** Reads the stored answer for a prefilled question from a participant record. */
export const readPrefillValue = (participant: Record<string, unknown> | null | undefined, key: PrefillKey) => {
    if (!participant) return ''
    for (const source of PREFILL_SOURCES[key]) {
        const value = participant[source]
        if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
    }
    return ''
}
