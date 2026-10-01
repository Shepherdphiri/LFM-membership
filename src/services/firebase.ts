import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Member, Contribution, ChurchSettings, Branch } from '../types';

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with custom database ID from config
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Test connection on boot per Firebase skill guidelines
export async function validateFirestoreConnection(): Promise<boolean> {
  try {
    const testDoc = doc(db, 'test', 'connection');
    await getDocFromServer(testDoc);
    return true;
  } catch (err: any) {
    if (err?.message?.includes('the client is offline')) {
      console.warn('Firestore is currently offline or waiting for network.');
    } else {
      console.log('Firestore connected successfully.');
    }
    return false;
  }
}

// ----------------------------------------------------
// MEMBERS (Cross-device real-time sync)
// ----------------------------------------------------

export async function syncMemberToFirestore(member: Member): Promise<void> {
  if (!member || !member.member_number) return;
  const cleanId = member.member_number.trim().toUpperCase();
  const ref = doc(db, 'members', cleanId);
  await setDoc(ref, {
    ...member,
    member_number: cleanId,
    updated_at: new Date().toISOString(),
  }, { merge: true });
}

export async function getMemberFromFirestore(memberNumber: string): Promise<Member | null> {
  if (!memberNumber) return null;
  const cleanId = memberNumber.trim().toUpperCase();
  const ref = doc(db, 'members', cleanId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as Member;
  }
  return null;
}

export async function getAllMembersFromFirestore(): Promise<Member[]> {
  try {
    const colRef = collection(db, 'members');
    const snap = await getDocs(colRef);
    const members: Member[] = [];
    snap.forEach((d) => {
      members.push(d.data() as Member);
    });
    return members;
  } catch (err) {
    console.error('Failed to fetch members from Firestore:', err);
    return [];
  }
}

export async function deleteMemberFromFirestore(memberNumber: string): Promise<void> {
  if (!memberNumber) return;
  const cleanId = memberNumber.trim().toUpperCase();
  const ref = doc(db, 'members', cleanId);
  await deleteDoc(ref);
}

export async function clearAllFirestoreMembers(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'members'));
    const deletions: Promise<void>[] = [];
    snap.forEach((d) => {
      deletions.push(deleteDoc(d.ref));
    });
    await Promise.all(deletions);
  } catch (err) {
    console.error('Failed to clear members from Firestore:', err);
  }
}

export async function clearAllFirestoreContributions(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'contributions'));
    const deletions: Promise<void>[] = [];
    snap.forEach((d) => {
      deletions.push(deleteDoc(d.ref));
    });
    await Promise.all(deletions);
  } catch (err) {
    console.error('Failed to clear contributions from Firestore:', err);
  }
}

/**
 * Subscribe to real-time member updates from Firestore across all devices.
 * Instant live update on laptop and phone.
 */
export function subscribeToMembersFromFirestore(onUpdate: (members: Member[]) => void): () => void {
  try {
    const colRef = collection(db, 'members');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const members: Member[] = [];
        snapshot.forEach((d) => {
          members.push(d.data() as Member);
        });
        onUpdate(members);
      },
      (error) => {
        console.warn('Firestore member snapshot subscription error:', error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Could not establish Firestore members subscription:', err);
    return () => {};
  }
}

// ----------------------------------------------------
// CONTRIBUTIONS & DUES (Cross-device sync)
// ----------------------------------------------------

export async function syncContributionToFirestore(contrib: Contribution): Promise<void> {
  if (!contrib || !contrib.receipt_no) return;
  const ref = doc(db, 'contributions', contrib.receipt_no);
  await setDoc(ref, {
    ...contrib,
    updated_at: new Date().toISOString(),
  }, { merge: true });
}

export async function getAllContributionsFromFirestore(): Promise<Contribution[]> {
  try {
    const colRef = collection(db, 'contributions');
    const snap = await getDocs(colRef);
    const contribs: Contribution[] = [];
    snap.forEach((d) => {
      contribs.push(d.data() as Contribution);
    });
    return contribs;
  } catch (err) {
    console.error('Failed to fetch contributions from Firestore:', err);
    return [];
  }
}

export function subscribeToContributionsFromFirestore(onUpdate: (contribs: Contribution[]) => void): () => void {
  try {
    const colRef = collection(db, 'contributions');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const contribs: Contribution[] = [];
        snapshot.forEach((d) => {
          contribs.push(d.data() as Contribution);
        });
        onUpdate(contribs);
      },
      (error) => {
        console.warn('Firestore contributions subscription error:', error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Could not establish Firestore contributions subscription:', err);
    return () => {};
  }
}

// ----------------------------------------------------
// CHURCH SETTINGS & BRANCHES
// ----------------------------------------------------

export async function syncChurchSettingsToFirestore(settings: ChurchSettings): Promise<void> {
  if (!settings) return;
  const ref = doc(db, 'settings', 'church');
  await setDoc(ref, {
    ...settings,
    updated_at: new Date().toISOString(),
  }, { merge: true });
}

export async function getChurchSettingsFromFirestore(): Promise<ChurchSettings | null> {
  try {
    const ref = doc(db, 'settings', 'church');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as ChurchSettings;
    }
  } catch (err) {
    console.warn('Failed to fetch church settings from Firestore:', err);
  }
  return null;
}

export function subscribeToChurchSettingsFromFirestore(onUpdate: (settings: ChurchSettings) => void): () => void {
  try {
    const ref = doc(db, 'settings', 'church');
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (snapshot.exists()) {
          onUpdate(snapshot.data() as ChurchSettings);
        }
      },
      (error) => {
        console.warn('Firestore settings subscription error:', error);
      }
    );
    return unsubscribe;
  } catch (err) {
    return () => {};
  }
}
