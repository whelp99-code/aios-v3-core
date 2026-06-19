/**
 * AttachmentReference — reference to an attachment (not the binary itself).
 */
export interface AttachmentReference {
  fileName: string;
  mimeType: string;
  size: number;
  storageRef: string;
  checksum: string;
}

export function createAttachmentReference(ref: Omit<AttachmentReference, 'checksum'> & { checksum?: string }): AttachmentReference {
  return {
    fileName: ref.fileName,
    mimeType: ref.mimeType,
    size: ref.size,
    storageRef: ref.storageRef,
    checksum: ref.checksum ?? `sha256:pending`,
  };
}
