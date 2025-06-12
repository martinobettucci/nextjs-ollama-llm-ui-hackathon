import { getOllamaUrl } from '@/lib/config';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const OLLAMA_URL = getOllamaUrl();
  console.log('OLLAMA_URL:', OLLAMA_URL);
  const res = await fetch(
    OLLAMA_URL + "/api/tags"
  );
  return new Response(res.body, res);
}