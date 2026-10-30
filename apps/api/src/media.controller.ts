import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, join, resolve } from 'node:path';
import { Controller, Get, Param, Post, Query, Req, Res, ServiceUnavailableException, UnsupportedMediaTypeException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminAuthGuard, hasValidAdminCookie } from './admin-auth.guard.js';
import { ContentService } from './content.service.js';
import { verifyDisplayMediaSignature } from './media-signing.js';

type RequestLike = { headers: { cookie?: string }; method: string };
type ResponseLike = { setHeader(name: string, value: string): void; status(code: number): ResponseLike; end(): void };
const uploadDirectory = resolve(process.env.UPLOAD_DIR ?? 'var/uploads');
mkdirSync(uploadDirectory, { recursive: true });
const supported = new Map([
  ['.pdf', 'application/pdf'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'], ['.mp4', 'video/mp4'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
]);
const officeExtensions = new Set(['.docx', '.pptx']);
const privateStorage = {
  _handleFile(_request: any, file: any, callback: any) {
    const filename = `${randomUUID()}${extname(file.originalname).toLowerCase()}`;
    const path = join(uploadDirectory, filename);
    const output = createWriteStream(path, { flags: 'wx' });
    let size = 0;
    file.stream.on('data', (chunk: Buffer) => { size += chunk.length; });
    output.on('error', callback);
    output.on('finish', () => callback(null, { destination: uploadDirectory, filename, path, size }));
    file.stream.pipe(output);
  },
  _removeFile(_request: any, file: any, callback: any) {
    unlink(file.path).then(() => callback(null), callback);
  },
};
function hasValidSignature(extension: string, bytes: Buffer): boolean {
  if (extension === '.pdf') return bytes.subarray(0, 5).equals(Buffer.from('%PDF-'));
  if (extension === '.png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (extension === '.jpg' || extension === '.jpeg') return bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if (extension === '.webp') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (extension === '.mp4') return bytes.toString('ascii', 4, 8) === 'ftyp';
  if (officeExtensions.has(extension)) return bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  return false;
}

@Controller('media')
export class MediaController {
  constructor(private readonly content: ContentService) {}

  @Post('upload')
  @UseGuards(AdminAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: privateStorage,
    limits: { fileSize: 40 * 1024 * 1024, files: 1 },
    fileFilter: (_request: any, file: any, callback: any) => {
      const extension = extname(file.originalname).toLowerCase();
      if (!supported.has(extension) || supported.get(extension) !== file.mimetype) {
        callback(new UnsupportedMediaTypeException('Desteklenmeyen dosya türü.'), false);
        return;
      }
      callback(null, true);
    },
  } as never))
  async upload(@UploadedFile() file: { path: string; filename: string; originalname: string; mimetype: string } | undefined) {
    if (!file) throw new UnsupportedMediaTypeException('Bir dosya seçin.');
    const extension = extname(file.filename).toLowerCase();
    const bytes = await readFile(file.path);
    if (!hasValidSignature(extension, bytes)) {
      await unlink(file.path).catch(() => undefined);
      throw new UnsupportedMediaTypeException('Dosya içeriği seçilen tür ile eşleşmiyor.');
    }
    if (officeExtensions.has(extension)) {
      try {
        const converted = await fetch(`http://127.0.0.1:3030/convert?format=${extension.slice(1)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes,
        });
        if (!converted.ok) throw new Error(`Dönüştürücü HTTP ${converted.status}`);
        const pdf = Buffer.from(await converted.arrayBuffer());
        if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-')) || pdf.length > 80 * 1024 * 1024) throw new Error('Geçersiz PDF çıktısı.');
        const pdfName = `${file.filename.slice(0, -extension.length)}.pdf`;
        await writeFile(join(uploadDirectory, pdfName), pdf, { flag: 'wx' });
        await unlink(file.path);
        return { url: `/media/${pdfName}`, name: file.originalname, mimeType: 'application/pdf' };
      } catch {
        await unlink(file.path).catch(() => undefined);
        throw new ServiceUnavailableException('Office belgesi PDF’e dönüştürülemedi. Yerel document-converter servisini kontrol edin.');
      }
    }
    return { url: `/media/${file.filename}`, name: file.originalname, mimeType: file.mimetype };
  }

  @Get(':filename')
  async send(
    @Param('filename') filename: string,
    @Query('displayId') displayId: string | undefined,
    @Query('expires') expires: string | undefined,
    @Query('signature') signature: string | undefined,
    @Req() request: RequestLike,
    @Res() response: ResponseLike,
  ) {
    if (!/^[a-f0-9-]{36}\.(pdf|png|jpg|jpeg|webp|mp4)$/.test(filename)) { response.status(404).end(); return; }
    const adminSession = hasValidAdminCookie(request);
    const displaySignature = Boolean(displayId && expires && signature && verifyDisplayMediaSignature(filename, displayId, expires, signature));
    if (!adminSession && !displaySignature) { response.status(403).end(); return; }
    if (!adminSession && displayId && !await this.isActiveDisplayAsset(filename, displayId)) { response.status(404).end(); return; }
    const path = join(uploadDirectory, filename);
    if (!existsSync(path)) { response.status(404).end(); return; }
    const extension = extname(filename);
    const mimeType = extension === '.pdf' ? 'application/pdf' : extension === '.png' ? 'image/png'
      : extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : extension === '.webp' ? 'image/webp' : 'video/mp4';
    response.setHeader('Content-Type', mimeType);
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', adminSession ? 'private, max-age=3600' : 'private, max-age=300');
    createReadStream(path).pipe(response as unknown as NodeJS.WritableStream);
  }

  private async isActiveDisplayAsset(filename: string, displayId: string): Promise<boolean> {
    const expected = `/media/${filename}`;
    const now = new Date();
    const entries = await this.content.list();
    return entries.some((entry) => entry.payload.attachmentUrl === expected
      && entry.schedule.displayIds.includes(displayId)
      && Date.parse(entry.schedule.startsAt) <= now.getTime()
      && now.getTime() < Date.parse(entry.schedule.endsAt)
      && (!entry.schedule.daysOfWeek?.length || entry.schedule.daysOfWeek.includes(now.getUTCDay())));
  }
}

