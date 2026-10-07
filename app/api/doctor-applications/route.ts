import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { appendDoctorApplication, uploadsDirectory, type DoctorApplication } from "../../../lib/doctor-applications";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_REQUEST_SIZE = 5 * 1024 * 1024;
type DocumentField = "qualification_cert" | "workplace_proof";

const documentFields: DocumentField[] = ["qualification_cert", "workplace_proof"];
const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

function detectedFileType(bytes: Uint8Array): { extension: string; mimeType: string } | null {
  if (bytes.length >= 5 && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-") {
    return { extension: ".pdf", mimeType: "application/pdf" };
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).every((byte, index) =>
    byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) {
    return { extension: ".png", mimeType: "image/png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: ".jpg", mimeType: "image/jpeg" };
  }
  return null;
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_SIZE) {
    return jsonError("The application is too large. Each document must be 2 MB or smaller.", 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Please submit the application as multipart form data.", 400);
  }

  const requiredTextFields = [
    "name",
    "specialization",
    "experience",
    "registration_number",
    "contact_email",
    "contact_phone",
    "hospital_location"
  ] as const;
  const fields: Record<string, string> = {};

  for (const field of requiredTextFields) {
    const value = formData.get(field);
    if (typeof value !== "string" || !value.trim()) {
      return jsonError(`Please provide ${field.replaceAll("_", " ")}.`, 400);
    }
    fields[field] = value.trim();
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.contact_email)) {
    return jsonError("Please provide a valid contact email.", 400);
  }
  if (!/^\d{1,2}$/.test(fields.experience) || Number(fields.experience) > 70) {
    return jsonError("Years of experience must be between 0 and 70.", 400);
  }

  const files: { field: DocumentField; file: File; filename: string; mimeType: string; bytes: Uint8Array }[] = [];
  for (const field of documentFields) {
    const value = formData.get(field);
    if (!(value instanceof File) || value.size === 0) {
      return jsonError(`Please attach ${field === "qualification_cert" ? "your qualification certificate" : "your current workplace proof"}.`, 400);
    }
    if (value.size > MAX_FILE_SIZE) {
      return jsonError("Each document must be 2 MB or smaller.", 413);
    }

    const originalExtension = path.extname(value.name).toLowerCase();
    if (!allowedExtensions.has(originalExtension)) {
      return jsonError("Documents must be PDF, JPG, JPEG, or PNG files.", 400);
    }

    const bytes = new Uint8Array(await value.arrayBuffer());
    const detected = detectedFileType(bytes);
    if (!detected || (originalExtension === ".jpeg" ? ".jpg" : originalExtension) !== detected.extension) {
      return jsonError("A document's file contents do not match its file type.", 400);
    }

    files.push({ field, file: value, filename: `${randomUUID()}${detected.extension}`, mimeType: detected.mimeType, bytes });
  }

  const applicationId = randomUUID();
  const savedFiles: string[] = [];
  try {
    for (const file of files) {
      await writeFile(path.join(uploadsDirectory, file.filename), file.bytes, { flag: "wx" });
      savedFiles.push(file.filename);
    }

    const documents: DoctorApplication["documents"] = {
      qualification_cert: (() => {
        const file = files.find(item => item.field === "qualification_cert")!;
        return { path: path.posix.join("uploads", file.filename), original_name: path.basename(file.file.name), mime_type: file.mimeType };
      })(),
      workplace_proof: (() => {
        const file = files.find(item => item.field === "workplace_proof")!;
        return { path: path.posix.join("uploads", file.filename), original_name: path.basename(file.file.name), mime_type: file.mimeType };
      })()
    };
    const application: DoctorApplication = {
      id: applicationId,
      status: "pending_manual_verification",
      submitted_at: new Date().toISOString(),
      name: fields.name,
      specialization: fields.specialization,
      experience: fields.experience,
      registration_number: fields.registration_number,
      contact_email: fields.contact_email,
      contact_phone: fields.contact_phone,
      hospital_location: fields.hospital_location,
      documents
    };
    await appendDoctorApplication(application);

    return Response.json({
      application_id: applicationId,
      status: "pending_manual_verification",
      message: "Your application was received and is pending manual verification."
    }, { status: 201 });
  } catch (error) {
    await Promise.all(savedFiles.map(filename =>
      unlink(path.join(uploadsDirectory, filename)).catch(cleanupError => {
        console.error(`Failed to remove incomplete doctor application file ${filename}.`, cleanupError);
      })
    ));
    console.error("Failed to store doctor application.", error);
    return jsonError("We could not save your application. Please try again.", 500);
  }
}
