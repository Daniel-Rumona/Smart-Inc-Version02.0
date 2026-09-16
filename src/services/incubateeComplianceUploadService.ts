import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { getFirebaseDb, getFirebaseStorage } from '@/config/firebase'
import type { FullIdentity } from '@/types/identity'

const cleanKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const participantFor = async (user: FullIdentity) => {
    const db = getFirebaseDb()
    const direct = await getDoc(doc(db, 'participants', user.uid))
    if (direct.exists()) return { id: direct.id, data: direct.data() }
    const byEmail = await getDocs(query(collection(db, 'participants'), where('email', '==', user.email)))
    return byEmail.empty ? { id: user.uid, data: {} } : { id: byEmail.docs[0].id, data: byEmail.docs[0].data() }
}

export const uploadIncubateeComplianceDocument = async (
    user: FullIdentity,
    values: { type: string, file: File, issueDate?: string, expiryDate?: string },
) => {
    const db = getFirebaseDb()
    const participant = await participantFor(user)
    const key = cleanKey(values.type)
    const storagePath = `complianceDocuments/${participant.id}/${key}/${Date.now()}_${values.file.name}`
    const storageRef = ref(getFirebaseStorage(), storagePath)
    await uploadBytes(storageRef, values.file)
    const url = await getDownloadURL(storageRef)
    await setDoc(doc(db, 'complianceDocuments', `${participant.id}-${key}`), {
        participantId: participant.id,
        programId: participant.data.programId || null,
        companyCode: user.companyCode || participant.data.companyCode || null,
        key,
        type: values.type,
        documentName: values.type,
        currentStatus: 'pending',
        verificationStatus: 'pending',
        fileName: values.file.name,
        url,
        issueDate: values.issueDate || null,
        expiryDate: values.expiryDate || null,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        uploadedBy: user.uid,
    }, { merge: true })
}
