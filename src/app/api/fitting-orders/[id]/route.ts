import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const orders = (await readData("fittingOrders.json")) as any[];
    
    const index = orders.findIndex((o: any) => o.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    
    orders[index] = { ...orders[index], ...body, updatedAt: new Date().toISOString() };
    await writeData("fittingOrders.json", orders);
    
    return NextResponse.json(orders[index]);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
