import { supabase } from '../lib/supabase';

/**
 * Constructs the Supabase Storage path for a check-in photo.
 * Path convention: {uid}/{date}/{filename} within the 'check-in-photos' bucket.
 */
export function buildCheckInPhotoPath(uid: string, date: string, filename: string): string {
  return `${uid}/${date}/${filename}`;
}

/**
 * Uploads a check-in photo to Supabase Storage and returns the public download URL.
 *
 * @param uid - The user's UID
 * @param date - The date string (YYYY-MM-DD)
 * @param file - The image Blob to upload
 * @param filename - The filename for the uploaded image
 * @returns The Supabase Storage public URL
 */
export async function uploadCheckInPhoto(
  uid: string,
  date: string,
  file: Blob,
  filename: string
): Promise<string> {
  const path = buildCheckInPhotoPath(uid, date, filename);

  const { error } = await supabase.storage
    .from('check-in-photos')
    .upload(path, file, {
      upsert: true,
      contentType: 'image/jpeg',
    });

  if (error) {
    console.error('Supabase Storage upload error:', error.message);
    throw error;
  }

  // Retrieve the public URL for the uploaded photo
  const { data } = supabase.storage
    .from('check-in-photos')
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Uploads a report image attachment to Supabase Storage and returns the public URL.
 */
export async function uploadReportImage(
  uid: string,
  date: string,
  file: Blob,
  filename: string
): Promise<string> {
  const path = `reports/${uid}/${date}/${filename}`;

  const { error } = await supabase.storage
    .from('check-in-photos')
    .upload(path, file, {
      upsert: true,
      contentType: 'image/jpeg',
    });

  if (error) {
    console.error('Report image upload error:', error.message);
    throw error;
  }

  const { data } = supabase.storage
    .from('check-in-photos')
    .getPublicUrl(path);

  return data.publicUrl;
}

