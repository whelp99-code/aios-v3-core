import { BaseEntity } from '../entities/index.js';

/**
 * MailMessage — a single email within a thread.
 */
export class MailMessage extends BaseEntity<string> {
  constructor(
    id: string,
    public readonly threadId: string,
    public readonly externalId: string,
    public readonly sender: string,
    public readonly recipients: string[],
    public readonly subject: string,
    public readonly bodyPreview: string,
    public readonly sentAt: Date,
    public readonly attachmentRefs: AttachmentReference[] = [],
    public readonly metadata: Record<string, unknown> = {}
  ) {
    super(id);
  }
}

/** Forward declaration for AttachmentReference */
interface AttachmentReference {
  fileName: string;
  mimeType: string;
  size: number;
  storageRef: string;
  checksum: string;
}
