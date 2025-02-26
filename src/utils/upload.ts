import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sha256 from 'sha256';
import slugify from 'slugify';

const {
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_ACCESS_KEY,
  CLOUDFLARE_SECRET_ACCESS_KEY,
  CLOUDFLARE_BUCKETNAME,
  CLOUDFLARE_BUCKET_URL,
} = process.env;

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: CLOUDFLARE_ACCESS_KEY!,
    secretAccessKey: CLOUDFLARE_SECRET_ACCESS_KEY!,
  },
});

const processFileName = (fileName: string) => {
  // List of valid image extensions
  const validExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff'];

  // Extract the file extension
  const extension = fileName.split('.').pop()?.toLowerCase();

  // Check if the file has a valid image extension
  if (extension && validExtensions.includes(extension)) {
    return fileName; // Return the file name as is if valid
  }

  // Remove existing extension and slugify the file name
  const baseName = fileName.split('.').slice(0, -1).join('.') || fileName;
  const slugifiedName = slugify(baseName, { lower: true });

  // Attach the default extension
  return `${slugifiedName}`;
};

export async function urlUpload(file: string, filename: string) {
  // Fetch the file from the URL
  const response = await fetch(file);
  if (!response.ok) {
    throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
  }

  // Convert the response data to a Buffer
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Generate a hash for the file
  const fileHash = await sha256(buffer);
  const sluggedName = processFileName(filename);

  // Extract content type and filename
  const contentType =
    response.headers.get('content-type') || 'application/octet-stream';
  const parts = contentType.split('/');
  try {
    const params = {
      Bucket: CLOUDFLARE_BUCKETNAME,
      Key: `comics/${fileHash}/${sluggedName}.${parts.length === 2 ? parts[1] : ''}`,
      ContentType: contentType,
      Body: buffer,
      // Metadata: {
      //   'x-amz-meta-file-hash': fileHash,
      // },
    };

    const command = new PutObjectCommand({ ...params });
    await R2.send(command);
    const location = `${CLOUDFLARE_BUCKET_URL}/resources/${fileHash}/${sluggedName}.${parts.length === 2 ? parts[1] : ''}`;

    return { location: location };
  } catch (err) {
    console.log('Error', err);
    return { Error: err };
  }
}
