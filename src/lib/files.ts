import { Platform, Share } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { notify } from './confirm';

// Everything that leaves or enters the app goes through here, so screens
// don't care whether they're on a phone or in a browser.

/** "Goa trip!" → "Goa-trip" (safe in a file name on every OS). */
export function fileSafe(name: string) {
  return name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'group';
}

/**
 * Runs right before the system share sheet opens. iOS can't show the share
 * sheet over one of our own modals, so callers close theirs here.
 */
type BeforeShare = () => Promise<void> | void;

/** Hands a text file to the share sheet (WhatsApp, Drive, Files…). Web downloads it. */
export async function shareTextFile(fileName: string, content: string, mimeType: string, beforeShare?: BeforeShare) {
  if (Platform.OS === 'web') {
    download(fileName, new Blob([content], { type: mimeType }));
    return;
  }
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(content);
  await beforeShare?.();
  await shareUri(file.uri, mimeType, fileName);
}

/** Renders HTML to a PDF and opens the share sheet. Web opens the print dialog (Save as PDF). */
export async function sharePdf(fileName: string, html: string, beforeShare?: BeforeShare) {
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (!w) {
      notify('Pop-up blocked', 'Allow pop-ups for this site to save the PDF.');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  // printToFileAsync picks a random name; give it one people recognise.
  const named = new File(Paths.cache, fileName);
  await new File(uri).move(named, { overwrite: true });
  await beforeShare?.();
  await shareUri(named.uri, 'application/pdf', fileName, 'com.adobe.pdf');
}

/** Plain message for WhatsApp/SMS. Browsers without a share sheet copy it instead. */
export async function shareMessage(message: string, beforeShare?: BeforeShare) {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ text: message }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(message);
      notify('Copied', 'The summary is on your clipboard. Paste it into any chat.');
    }
    return;
  }
  await beforeShare?.();
  await Share.share({ message });
}

/** Lets the user pick a file and returns its text, or null if they cancelled. */
export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  // '*/*' rather than JSON: files saved from WhatsApp often lose their type.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > 5 * 1024 * 1024) throw new Error('That file is too big to be a Vilarci Split backup.');
  const text = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
  return { name: asset.name, text };
}

async function shareUri(uri: string, mimeType: string, title: string, UTI?: string) {
  if (!(await Sharing.isAvailableAsync())) {
    notify('Sharing unavailable', "This device can't open the share sheet.");
    return;
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: title, ...(UTI ? { UTI } : {}) });
}

function download(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
