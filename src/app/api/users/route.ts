import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';

const FILE_NAME = 'users.json';

export async function GET() {
  try {
    const users = await readData(FILE_NAME);
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const newUser = await request.json();
    const users = await readData<any>(FILE_NAME);
    
    newUser.id = `u${Date.now()}`;
    newUser.createdAt = new Date().toISOString();
    
    users.push(newUser);
    await writeData(FILE_NAME, users);
    
    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
