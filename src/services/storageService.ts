import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Constructs the Firebase Storage path for a check-in photo.
 * Path convention: check-in-photos/{uid}/{date}/{filename}
 */
export function buildCheckInPhotoPath(uid: string, date: string, filename: string): string {
  return `check-in-photos/${uid}/${date}/${filename}`;
}

/**
 * Uploads a check-in photo to Firebase Storage and returns the download URL.
 *
 * @param uid - The user's Firebase UID
 * @param date - The date string (YYYY-MM-DD)
 * @param file - The image Blob to upload
 * @param filename - The filename for the uploaded image
 * @returns The Firebase Storage download URL
 */
export async function uploadCheckInPhoto(
  uid: string,
  date: string,
  file: Blob,
  filename: string
): Promise<string> {
  const storage = getStorage();
  const path = buildCheckInPhotoPath(uid, date, filename);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
