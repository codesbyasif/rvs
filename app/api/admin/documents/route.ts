import { readFile } from "node:fs/promises";
import path from "node:path";
import { isAdminRequest } from "../../../../lib/admin-auth";
import { readDoctorApplications, uploadsDirectory, type DoctorDocumentField } from "../../../../lib/doctor-applications";

export const runtime = "nodejs";

const validFields = new Set<DoctorDocumentField>(["qualification_cert", "workplace_proof"]);

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Admin sign-in required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const applicationId = url.searchParams.get("application_id");
  const field = url.searchParams.get("field") as DoctorDocumentField | null;
  if (!applicationId || !field || !validFields.has(field)) {
    return Response.json({ error: "A valid application ID and document field are required." }, { status: 400 });
  }

  try {
    const application = (await readDoctorApplications()).find(item => item.id === applicationId);
    if (!application) return Response.json({ error: "Application not found." }, { status: 404 });
    const document = application.documents[field];
    if (!document) return Response.json({ error: "Document not found." }, { status: 404 });

    const filename = path.basename(document.path);
    if (path.posix.dirname(document.path) !== "uploads" || !/^[0-9a-f-]{36}\.(pdf|jpg|png)$/i.test(filename)) {
      return Response.json({ error: "Stored document path is invalid." }, { status: 500 });
    }
    const bytes = await readFile(path.join(uploadsDirectory, filename));
    const mimeType = filename.endsWith(".pdf") ? "application/pdf" : filename.endsWith(".png") ? "image/png" : "image/jpeg";
    return new Response(bytes, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    console.error("Failed to serve doctor verification document.", error);
    return Response.json({ error: "The verification document could not be opened." }, { status: 500 });
  }
}
