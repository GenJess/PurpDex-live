import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    "accountAssociation": {
      "header": "eyJmaWQiOjg5Njg1MjQ1LCJ0eXBlIjoiY3VzdG9keSIsImtleSI6IjB4ODJhYmQxYzg5NWFjZDU4ZjFmMTE1NTQyYWViYWY2NWQ2ZmE2ZmIzMCJ9",
      "payload": "eyJkb21haW4iOiJiaWctYnV5Lm1lIn0",
      "signature": "MHgyZThhYjNkMjJjYzRmYTFjYjkyZGU1YTFjN2U5YjNmZGI2YWI0YTVjZTFhMWI0YWE3YTljZTY5NWI3NWY5YTgzMTgyZGYzMmUwZTZkYjJlZGM1YzU4Zjc2YWIwMDU1YTFmNzQ4ZDliNjZlNzIxYmM2YThjMTU1M2FlYTNjODFiMWI"
    },
    "frame": {
      "version": "1",
      "name": "Big-Buy.me",
      "iconUrl": "https://big-buy.me/placeholder.jpg",
      "homeUrl": "https://big-buy.me",
      "imageUrl": "https://big-buy.me/placeholder.jpg",
      "splashImageUrl": "https://big-buy.me/placeholder.jpg",
      "splashBackgroundColor": "#000000",
      "webhookUrl": "https://big-buy.me/api/webhook"
    }
  };

  return NextResponse.json(manifest);
}
