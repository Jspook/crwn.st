import { NextResponse } from "next/server";
import { readData, writeData, generateId } from "@/lib/db";

export async function GET() {
  try {
    const receipts = await readData("receipts.json");
    return NextResponse.json(receipts);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch receipts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const receipts = (await readData("receipts.json")) as any[];
    const products = (await readData("products.json")) as any[];
    
    // Validate and deduct stock
    for (const item of body.items) {
      const productIndex = products.findIndex((p: any) => p.id === item.productId);
      if (productIndex !== -1) {
        const variantIndex = products[productIndex].variants.findIndex((v: any) => v.sku === item.sku);
        if (variantIndex !== -1) {
          if (products[productIndex].variants[variantIndex].stock < item.quantity) {
             return NextResponse.json({ error: `Insufficient stock for ${item.name}` }, { status: 400 });
          }
          products[productIndex].variants[variantIndex].stock -= item.quantity;
        }
      }
    }
    
    const newReceipt = {
      ...body,
      id: generateId("rcpt"),
      createdAt: new Date().toISOString()
    };
    
    receipts.push(newReceipt);
    
    // Save both databases
    await writeData("products.json", products);
    await writeData("receipts.json", receipts);
    
    return NextResponse.json(newReceipt, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create receipt" }, { status: 500 });
  }
}
