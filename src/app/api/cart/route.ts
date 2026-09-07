import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const carts = await readData("cart.json") as any[];
    const userCart = carts.find((c: any) => c.userId === session.id);
    return NextResponse.json(userCart || { userId: session.id, items: [] });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch cart" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { items } = await request.json();
    const carts = await readData("cart.json") as any[];
    const cartIndex = carts.findIndex((c: any) => c.userId === session.id);

    if (cartIndex > -1) {
      carts[cartIndex].items = items;
      carts[cartIndex].updatedAt = new Date().toISOString();
    } else {
      carts.push({
        userId: session.id,
        items,
        updatedAt: new Date().toISOString()
      });
    }

    await writeData("cart.json", carts);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update cart" }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const carts = await readData("cart.json") as any[];
    const filteredCarts = carts.filter((c: any) => c.userId !== session.id);
    await writeData("cart.json", filteredCarts);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to clear cart" }, { status: 500 });
  }
}
