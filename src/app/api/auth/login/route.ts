import { NextResponse } from "next/server";
import { readData } from "@/lib/db";
import { createSession } from "@/lib/session";

interface User {
  id: string;
  username?: string;
  password?: string;
  phone?: string;
  name: string;
  role: string;
}

export async function POST(request: Request) {
  try {
    const { loginType, identifier, password } = await request.json();
    const users = await readData<User>("users.json");

    let matchedUser: User | undefined;

    if (loginType === "staff") {
      matchedUser = users.find(
        (u) =>
          u.username === identifier &&
          u.password === password &&
          (u.role === "CASHIER" || u.role === "FITTING_STAFF")
      );
    } else if (loginType === "customer") {
      matchedUser = users.find(
        (u) => u.phone === identifier && u.role === "CUSTOMER"
      );
    }

    if (!matchedUser) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Create session
    await createSession({
      id: matchedUser.id,
      name: matchedUser.name,
      role: matchedUser.role,
    });

    let redirectUrl = "/";
    if (matchedUser.role === "CASHIER") redirectUrl = "/staff/cashier";
    if (matchedUser.role === "FITTING_STAFF") redirectUrl = "/staff/fitting";
    if (matchedUser.role === "CUSTOMER") redirectUrl = "/customer/dashboard";

    return NextResponse.json({ success: true, redirectUrl });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
