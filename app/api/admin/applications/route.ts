import { isAdminRequest } from "../../../../lib/admin-auth";
import { readDoctorApplications, updateDoctorApplication } from "../../../../lib/doctor-applications";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Admin sign-in required." }, { status: 401 });
  }
  try {
    const applications = await readDoctorApplications();
    return Response.json({ applications: applications.sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)) }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    console.error("Failed to read doctor applications for admin review.", error);
    return Response.json({ error: "Doctor applications could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Admin sign-in required." }, { status: 401 });
  }

  let payload: { application_id?: unknown; status?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid review request." }, { status: 400 });
  }
  if (typeof payload.application_id !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.application_id)) {
    return Response.json({ error: "A valid application ID is required." }, { status: 400 });
  }
  if (payload.status !== "approved" && payload.status !== "rejected") {
    return Response.json({ error: "Choose approved or rejected." }, { status: 400 });
  }

  try {
    const application = await updateDoctorApplication(payload.application_id, payload.status);
    if (!application) return Response.json({ error: "Application not found." }, { status: 404 });
    return Response.json({ application });
  } catch (error) {
    console.error("Failed to save doctor application review.", error);
    return Response.json({ error: "The review decision could not be saved." }, { status: 500 });
  }
}
