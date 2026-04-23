declare module "backblaze-b2" {
  export default class B2 {
    constructor(opts: {
      applicationKeyId: string;
      applicationKey: string;
    });
    authorize(): Promise<{ data: unknown }>;
    getUploadUrl(args: { bucketId: string }): Promise<{
      data: { uploadUrl: string; authorizationToken: string };
    }>;
    uploadFile(args: {
      uploadUrl: string;
      uploadAuthToken: string;
      fileName: string;
      data: Buffer;
      mime?: string;
      contentLength?: number;
    }): Promise<{ data: { fileName: string } }>;
  }
}
