import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    "accountAssociation": {
      "header": "eyJmaWQiOjg5NjQ1MCwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDIzM2JhQjY0VjlsQUJ1NjlNYzNRRlNKdGViemZjSTBLRC1DYXVxVlJ4MnhFYWJLTGhRMWZRLVpER1RKeU1uY0FGMTZZZkZtcCJ9",
      "payload": "eyJkb21haW4iOiJiaWctYnV5Lm1lIn0=",
      "signature": "MHgyZThhYjNmZjJhNGZjYjNjY2JjZGI3ZjA0N2ZiYTk1YmE2N2I2MTU2YjZmYmI3ZjE3YmRiNmQzZjlmNDU4Yjc4NTM2YzJmZTU4ODZlMGJhYjQ5Y2E2ZGUzNTMzYzA3YmFhMzEwM2I0NzY2ZmFkYTJmYWY0YTI5N2ZiNjE5NmRhM2I2ZjZiMjNiZDZjZjY3YWJmMGRGJTVOE2ZDUNHRVzQjlQ=="
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
