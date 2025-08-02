import * as functions from 'firebase-functions';
import * as ftp from 'basic-ftp';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

interface FtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
}

interface FtpUploadData {
  fileUrl: string;
  remotePath: string;
  ftpConfig: FtpConfig;
}

export const ftpUpload = functions.https.onCall(
  async (
    data: any,
    context: any
  ) => {
    // Check if user is authenticated
    if (!context || !context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { fileUrl, remotePath, ftpConfig } = data;

    if (!fileUrl || !remotePath || !ftpConfig) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required parameters'
      );
    }

    const tempFilePath = path.join(os.tmpdir(), path.basename(remotePath));

    try {
      // Download file from Firebase Storage URL
      const response = await fetch(fileUrl);
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(tempFilePath, Buffer.from(buffer));

      // Upload to FTP
      const client = new ftp.Client();
      client.ftp.verbose = true;

      await client.access({
        host: ftpConfig.host,
        port: ftpConfig.port || 21,
        user: ftpConfig.user,
        password: ftpConfig.password,
        secure: ftpConfig.secure || false,
      });

      await client.uploadFrom(tempFilePath, remotePath);
      await client.close();

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      return {
        success: true,
        message: 'File uploaded successfully to FTP server',
        path: remotePath,
      } as const;
    } catch (error) {
      throw new functions.https.HttpsError(
        'unknown',
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }
);
