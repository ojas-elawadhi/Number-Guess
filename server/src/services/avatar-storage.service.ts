import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const AVATAR_OBJECT_PATTERN = /^v[1-9]\d*\/[a-z0-9-]+\.webp$/;
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

type AvatarStorageConfig = {
  accessKeyId: string;
  bucketName: string;
  endpoint: string;
  region: string;
  secretAccessKey: string;
  urlStyle: string;
};

const readAvatarStorageConfig = (): AvatarStorageConfig | null => {
  const values = {
    accessKeyId: process.env.AVATAR_BUCKET_ACCESS_KEY_ID,
    bucketName: process.env.AVATAR_BUCKET_NAME,
    endpoint: process.env.AVATAR_BUCKET_ENDPOINT,
    region: process.env.AVATAR_BUCKET_REGION,
    secretAccessKey: process.env.AVATAR_BUCKET_SECRET_ACCESS_KEY,
    urlStyle: process.env.AVATAR_BUCKET_URL_STYLE
  };
  const configuredValues = Object.values(values).filter(Boolean);

  if (configuredValues.length === 0) {
    return null;
  }

  if (configuredValues.length !== Object.keys(values).length) {
    throw new Error("Avatar bucket configuration is incomplete.");
  }

  return values as AvatarStorageConfig;
};

const config = readAvatarStorageConfig();
const client = config
  ? new S3Client({
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      endpoint: config.endpoint,
      forcePathStyle: config.urlStyle === "path",
      region: config.region
    })
  : null;

export const isAvatarStorageConfigured = Boolean(config && client);

export const getAvatarObjectKey = (version: string, filename: string) => {
  const key = `${version}/${filename}`;
  return AVATAR_OBJECT_PATTERN.test(key) ? `avatars/${key}` : null;
};

export const getAvatarDownloadUrl = async (key: string) => {
  if (!config || !client) {
    throw new Error("Avatar bucket is not configured.");
  }

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key
    }),
    { expiresIn: SIGNED_URL_TTL_SECONDS }
  );
};
