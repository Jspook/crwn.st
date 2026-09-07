import { NextResponse } from "next/server";
import { readData, writeData, generateId } from "@/lib/db";

export async function GET() {
  try {
    const orders = await readData("fittingOrders.json");
    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch fitting orders" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orders = (await readData("fittingOrders.json")) as any[];
    
    const newOrder = {
      ...body,
      id: generateId("order"),
      status: "pending",
      createdAt: new Date().toISOString()
    };
    
    orders.push(newOrder);
    await writeData("fittingOrders.json", orders);
    
    return NextResponse.json(newOrder, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create fitting order" }, { status: 500 });
  }
}
