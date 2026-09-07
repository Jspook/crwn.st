import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';

const FILE_NAME = 'fittingRooms.json';

export async function GET() {
  try {
    const rooms = await readData(FILE_NAME);
    return NextResponse.json(rooms);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch fitting rooms' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const updatedRoom = await request.json();
    const rooms = await readData<any>(FILE_NAME);
    
    const index = rooms.findIndex((r: any) => r.id === updatedRoom.id);
    if (index !== -1) {
      rooms[index] = { ...rooms[index], ...updatedRoom };
      await writeData(FILE_NAME, rooms);
      return NextResponse.json(rooms[index]);
    } else {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update fitting room' }, { status: 500 });
  }
}
