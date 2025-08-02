"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ftpUpload = void 0;
const functions = __importStar(require("firebase-functions"));
const ftp = __importStar(require("basic-ftp"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
exports.ftpUpload = functions.https.onCall(async (data, context) => {
    // Check if user is authenticated
    if (!context || !context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { fileUrl, remotePath, ftpConfig } = data;
    if (!fileUrl || !remotePath || !ftpConfig) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
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
        };
    }
    catch (error) {
        throw new functions.https.HttpsError('unknown', error instanceof Error ? error.message : 'Unknown error occurred');
    }
});
