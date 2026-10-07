import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type DoctorApplicationStatus = "pending_manual_verification" | "approved" | "rejected";
export type DoctorDocumentField = "qualification_cert" | "workplace_proof";

export type DoctorApplication = {
  id: string;
  status: DoctorApplicationStatus;
  submitted_at: string;
  reviewed_at?: string;
  name: string;
  specialization: string;
  experience: string;
  registration_number: string;
  contact_email: string;
  contact_phone: string;
  hospital_location: string;
  documents: Record<DoctorDocumentField, {
    path: string;
    original_name: string;
    mime_type: string;
  }>;
};

export const uploadsDirectory = path.join(process.cwd(), "uploads");
const applicationsFile = path.join(uploadsDirectory, "doctor-applications.jsonl");

export async function readDoctorApplications(): Promise<DoctorApplication[]> {
  try {
    const contents = await readFile(applicationsFile, "utf8");
    return contents.split(/\r?\n/).filter(Boolean).map((line, index) => {
      try {
        return JSON.parse(line) as DoctorApplication;
      } catch (error) {
        console.error(`Invalid doctor application record on line ${index + 1}.`, error);
        throw new Error("Doctor application storage contains an invalid record.");
      }
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

export async function appendDoctorApplication(application: DoctorApplication): Promise<void> {
  await mkdir(uploadsDirectory, { recursive: true });
  await appendFile(applicationsFile, `${JSON.stringify(application)}\n`, { encoding: "utf8", flag: "a" });
}

export async function updateDoctorApplication(
  applicationId: string,
  status: Exclude<DoctorApplicationStatus, "pending_manual_verification">
): Promise<DoctorApplication | null> {
  const applications = await readDoctorApplications();
  const applicationIndex = applications.findIndex(application => application.id === applicationId);
  if (applicationIndex === -1) return null;

  const updatedApplication = {
    ...applications[applicationIndex],
    status,
    reviewed_at: new Date().toISOString()
  };
  applications[applicationIndex] = updatedApplication;

  const temporaryFile = path.join(uploadsDirectory, `doctor-applications-${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryFile, `${applications.map(application => JSON.stringify(application)).join("\n")}\n`, "utf8");
    await rename(temporaryFile, applicationsFile);
  } catch (error) {
    console.error("Failed to update doctor application review status.", error);
    throw error;
  }
  return updatedApplication;
}
