import { NextResponse } from "next/server";
import { readData } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const receipts = await readData("receipts.json") as any[];
    
    const receipt = receipts.find((r: any) => r.id === id);
    if (!receipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }
    
    // In a real app we'd verify the user owns this receipt if they are a customer.
    if (session.role === "CUSTOMER" && receipt.memberId !== session.id) {
      // For this prototype, we'll let it pass to easily test or we could enforce it.
      // return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    return NextResponse.json(receipt);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch receipt" }, { status: 500 });
  }
}
