import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function uploadFile(file: File, path: string): Promise<string> {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}

// Unified English EGP currency formatter
export function formatEGP(value: number | null | undefined, opts?: Intl.NumberFormatOptions) {
  const n = Number(value || 0);
  // en-EG ensures English locale; currency EGP with two decimals by default
  return n.toLocaleString('en-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  });
}
