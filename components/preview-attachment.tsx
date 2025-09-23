import type { Attachment } from '@/lib/types';
import { Loader } from './elements/loader';
import { CrossSmallIcon } from './icons';
import { Button } from './ui/button';
import Image from 'next/image';
import { FileText } from 'lucide-react';

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onRemove,
  onEdit,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onRemove?: () => void;
  onEdit?: () => void;
}) => {
  const { name, url, contentType } = attachment;
  const isImage = Boolean(contentType?.startsWith('image'));
  const isPdf = contentType === 'application/pdf';

  return (
    <div
      data-testid="input-attachment-preview"
      className="group relative size-16 rounded-lg overflow-hidden bg-muted border"
    >
      {isImage ? (
        <Image
          src={url}
          alt={name ?? 'An image attachment'}
          className="size-full object-cover"
          width={64}
          height={64}
        />
      ) : (
        <div className="size-full flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground bg-muted/80">
          <FileText className="size-4" aria-hidden="true" />
          <span className="font-medium uppercase tracking-wide">
            {isPdf ? 'PDF' : 'FILE'}
          </span>
        </div>
      )}

      {isUploading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/50"
          data-testid="input-attachment-loader"
        >
          <Loader size={16} />
        </div>
      )}

      {onRemove && !isUploading && (
        <Button
          onClick={onRemove}
          size="sm"
          variant="destructive"
          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity size-4 p-0 rounded-full"
        >
          <CrossSmallIcon size={8} />
        </Button>
      )}

      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent text-white text-[10px] px-1 py-0.5 truncate">
        {name}
      </div>
    </div>
  );
};
