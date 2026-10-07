import { adminCookieName, adminCookieOptions, createAdminSession, isAdminRequest, verifyAdminPassword } from "../../../../lib/admin-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return Response.json({ authenticated: isAdminRequest(request) });
}

export async function POST(request: Request) {
  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return Response.json({ error: "Enter the admin password." }, { status: 400 });
  }
  if (typeof password !== "string") {
    return Response.json({ error: "Enter the admin password." }, { status: 400 });
  }

  try {
    if (!verifyAdminPassword(password)) {
      return Response.json({ error: "The admin password is incorrect." }, { status: 401 });
    }
    const session = createAdminSession();
    const response = Response.json({ authenticated: true });
    response.headers.append("Set-Cookie", [
      `${adminCookieName}=${session.value}`,
      ...adminCookieOptions(session.maxAge).slice(1)
    ].join("; "));
    return response;
  } catch (error) {
    console.error("Admin sign-in is not configured.", error);
    return Response.json({ error: "Admin sign-in is not configured. Set the required server environment variables." }, { status: 503 });
  }
}

export async function DELETE() {
  const response = Response.json({ authenticated: false });
  response.headers.append("Set-Cookie", adminCookieOptions(0).join("; "));
  return response;
}
