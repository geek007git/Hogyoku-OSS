import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { config } from "../config.js";

export const storage = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: config.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY,
    secretAccessKey: config.S3_SECRET_KEY,
  },
});

export async function ensureBucket(): Promise<void> {
  try {
    await storage.send(new HeadBucketCommand({ Bucket: config.S3_BUCKET }));
  } catch {
    await storage.send(new CreateBucketCommand({ Bucket: config.S3_BUCKET }));
  }
}

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await storage.send(
    new PutObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    }),
  );
}

export async function downloadObject(key: string): Promise<Buffer> {
  const object = await storage.send(
    new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }),
  );
  if (!object.Body) throw new Error(`Storage object ${key} has no body`);
  return Buffer.from(await object.Body.transformToByteArray());
}
