const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export async function getHealth(): Promise<{ status: string }> {
  const res = await fetch(`${BASE_URL}/v1/health`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
