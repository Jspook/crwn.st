import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';

const FILE_NAME = 'products.json';

export async function GET() {
  try {
    const products = await readData(FILE_NAME);
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const newProduct = await request.json();
    const products = await readData<any>(FILE_NAME);
    
    newProduct.id = `p${Date.now()}`;
    
    products.push(newProduct);
    await writeData(FILE_NAME, products);
    
    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
