import { NextResponse } from "next/server";
import { readData } from "@/lib/db";

interface Variant {
  sku: string;
  size: string;
  color: string;
  stock: number;
}

interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  price: number;
  tags: string[];
  variants: Variant[];
  image: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const products = await readData<Product>("products.json");
    const product = products.find((p) => p.barcode === code);

    if (!product) {
      return NextResponse.json(
        { error: "Product not found for this barcode" },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to look up barcode" },
      { status: 500 }
    );
  }
}
